// Enhanced Service Worker v2.1.1 with Advanced Caching and Performance Optimizations
// sw.js

const VERSION = '2.1.1';
const CACHE_NAMES = {
  static: `dao-static-v${VERSION}`,
  dynamic: `dao-dynamic-v${VERSION}`,
  images: `dao-images-v${VERSION}`,
  api: `dao-api-v${VERSION}`
};

const CACHE_LIMITS_MB = {
  [CACHE_NAMES.dynamic]: 50,
  [CACHE_NAMES.images]: 100,
  [CACHE_NAMES.api]: 25
};

const CACHE_EXPIRY_MS = {
  [CACHE_NAMES.static]: 7 * 24 * 60 * 60 * 1000, // 7 days
  [CACHE_NAMES.dynamic]: 24 * 60 * 60 * 1000,    // 24 hours
  [CACHE_NAMES.images]: 7 * 24 * 60 * 60 * 1000, // 7 days
  [CACHE_NAMES.api]: 5 * 60 * 1000                // 5 minutes
};

// Critical static assets to pre-cache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/offline.html'
  // Add other critical static assets here
];

/**
 * Strategy map - keys are patterns matched against the request hostname or url.
 * Values: 'networkFirst' | 'cacheFirst' | 'cacheOnly' | 'staleWhileRevalidate'
 *
 * Patterns will be matched against the request hostname first, then the full url if hostname match doesn't apply.
 */
const STRATEGY_MAP = new Map([
  ['rpc.test2.btcs.network', 'networkFirst'],
  ['scan.test2.btcs.network', 'networkFirst'],
  ['api.', 'networkFirst'], // any hostname containing api.
  ['cdn.jsdelivr.net', 'cacheFirst'],
  ['cdnjs.cloudflare.com', 'cacheFirst'],
  ['fonts.googleapis.com', 'cacheFirst'],
  ['fonts.gstatic.com', 'cacheFirst']
]);

let requestQueue = [];
const MAX_QUEUE_SIZE = 100;

// Performance metrics (kept in-memory)
const performanceMetrics = {
  totalRequests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  networkRequests: 0,
  averageResponseTime: 0
};

self.addEventListener('install', event => {
  console.log(`[SW v${VERSION}] Installing...`);
  event.waitUntil(
    caches.open(CACHE_NAMES.static)
      .then(cache => Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(e => console.warn(`[SW] Failed to cache ${url}`, e)))
      ))
      .then(() => Promise.all(Object.values(CACHE_NAMES).map(name => caches.open(name))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  console.log(`[SW v${VERSION}] Activating...`);
  event.waitUntil(
    cleanupOldCaches()
      .then(initializeDB)
      .then(() => self.clients.claim())
      .then(() => broadcastToClients({ type: 'SW_ACTIVATED', version: VERSION }))
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  // Only handle GET HTTP(s) requests; let other methods through for default browser handling.
  if (request.method !== 'GET' || !request.url.startsWith('http') || request.headers.get('cache-control') === 'no-cache') {
    return;
  }

  const startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const strategy = determineStrategy(request.url);
  performanceMetrics.totalRequests++;

  event.respondWith(
    handleRequest(request, strategy)
      .then(response => {
        recordMetrics(startTime, response ? (response.fromCache === true) : false);
        // Remove internal 'fromCache' marker if present (we may have attached it).
        return response instanceof Response ? response : response;
      })
      .catch(async error => {
        return handleFetchError(request, error);
      })
  );
});

function determineStrategy(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Images: always cacheFirst
    if (isImageRequest(url)) return 'cacheFirst';

    // API endpoints: prefer networkFirst
    if (urlObj.pathname.includes('/api/')) return 'networkFirst';

    // Check strategies by hostname or url substring
    for (const [pattern, strategy] of STRATEGY_MAP) {
      // If pattern contains a dot or slash, match against hostname first, then full url.
      if (hostname.includes(pattern) || url.includes(pattern)) return strategy;
    }

    if (isStaticAsset(url)) return 'cacheOnly';
    return 'staleWhileRevalidate';
  } catch (e) {
    // If URL parsing fails, fall back to safe default
    return 'staleWhileRevalidate';
  }
}

async function handleRequest(request, strategy) {
  switch (strategy) {
    case 'networkFirst': return networkFirst(request);
    case 'cacheFirst': return cacheFirst(request);
    case 'cacheOnly': return cacheOnly(request);
    case 'staleWhileRevalidate': return staleWhileRevalidate(request);
    default: return fetch(request);
  }
}

async function networkFirst(request, timeout = 5000) {
  const cacheName = getCacheNameForRequest(request);
  try {
    // Race fetch vs timeout - if fetch wins, cache and return
    const fetchPromise = fetch(request);
    const response = await Promise.race([fetchPromise, timeoutPromise(timeout)]);
    if (response && response.ok) {
      await cacheResponse(cacheName, request, response.clone());
      performanceMetrics.networkRequests++;
      // mark response as not-from-cache for metrics bookkeeping
      const r = response;
      r.fromCache = false;
      return r;
    }
  } catch (err) {
    // ignore and fall back to cache
  }
  const cached = await getCachedResponse(cacheName, request);
  if (cached) {
    performanceMetrics.cacheHits++;
    cached.fromCache = true;
    return cached;
  }
  // No network and no cache
  throw new Error('No network or cache available');
}

function timeoutPromise(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('Network timeout')), ms));
}

async function cacheFirst(request) {
  const cacheName = getCacheNameForRequest(request);
  const cached = await getCachedResponse(cacheName, request);
  if (cached) {
    performanceMetrics.cacheHits++;
    // update in background but don't hold the response
    updateCacheInBackground(request, cacheName);
    cached.fromCache = true;
    return cached;
  }
  performanceMetrics.cacheMisses++;
  const response = await fetch(request);
  if (response && response.ok) {
    await cacheResponse(cacheName, request, response.clone());
  }
  response.fromCache = false;
  return response;
}

async function cacheOnly(request) {
  const cached = await caches.match(request);
  if (cached) {
    performanceMetrics.cacheHits++;
    cached.fromCache = true;
    return cached;
  }
  performanceMetrics.cacheMisses++;
  // As a fallback, attempt network fetch and populate static cache
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAMES.static);
      await cache.put(request, response.clone());
      response.fromCache = false;
      return response;
    }
  } catch (e) {
    // continue to returning offline fallback below
  }
  return new Response('Not found', { status: 404 });
}

async function staleWhileRevalidate(request) {
  const cacheName = CACHE_NAMES.dynamic;
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(async response => {
    if (response && response.ok) await cacheResponse(cacheName, request, response.clone());
    return response;
  }).catch(() => null);

  if (cached) {
    performanceMetrics.cacheHits++;
    cached.fromCache = true;
    // Kick off background fetch (we already created fetchPromise above)
    fetchPromise.catch(() => {});
    return cached;
  }
  performanceMetrics.cacheMisses++;
  const fresh = await fetchPromise;
  if (fresh) {
    fresh.fromCache = false;
    return fresh;
  }
  // If fetch failed and nothing in cache, return 503
  return new Response('Service Unavailable', { status: 503 });
}

function getCacheNameForRequest(request) {
  const url = (typeof request === 'string') ? request : request.url;
  if (isImageRequest(url)) return CACHE_NAMES.images;
  if (url.includes('/api/')) return CACHE_NAMES.api;
  if (isStaticAsset(url)) return CACHE_NAMES.static;
  return CACHE_NAMES.dynamic;
}

async function cacheResponse(cacheName, request, response) {
  try {
    // Ensure we have a fresh clone to store
    const respToCache = response.clone();
    if (await isCacheFull(cacheName)) {
      await evictOldestEntries(cacheName);
    }
    const cache = await caches.open(cacheName);

    // Add a header to mark when it was cached
    const headers = new Headers(respToCache.headers);
    headers.set('sw-cached-at', Date.now().toString());

    // Create a new Response with the same body but updated headers.
    // Use arrayBuffer to avoid reusing consumed streams in some browsers.
    const buffer = await respToCache.arrayBuffer();
    const modifiedResponse = new Response(buffer, {
      status: respToCache.status,
      statusText: respToCache.statusText,
      headers
    });

    await cache.put(request, modifiedResponse);
    return true;
  } catch (err) {
    console.warn('[SW] cacheResponse failed', err);
    return false;
  }
}

async function getCachedResponse(cacheName, request) {
  try {
    const cache = await caches.open(cacheName);
    const response = await cache.match(request);
    if (!response) return null;
    const cachedAt = response.headers.get('sw-cached-at');
    if (cachedAt) {
      const age = Date.now() - parseInt(cachedAt, 10);
      const maxAge = CACHE_EXPIRY_MS[cacheName] ?? CACHE_EXPIRY_MS[CACHE_NAMES.dynamic];
      if (age > maxAge) {
        await cache.delete(request);
        return null;
      }
    }
    return response;
  } catch (err) {
    console.warn('[SW] getCachedResponse error', err);
    return null;
  }
}

let cacheSizeCache = {};
let lastSizeCheck = 0;

async function isCacheFull(cacheName) {
  const limit = CACHE_LIMITS_MB[cacheName];
  if (!limit) return false;
  const now = Date.now();
  if (now - lastSizeCheck < 60000 && cacheSizeCache[cacheName] !== undefined) {
    return cacheSizeCache[cacheName] >= limit * 1024 * 1024;
  }
  const size = await getCacheSize(cacheName);
  cacheSizeCache[cacheName] = size;
  lastSizeCheck = now;
  return size >= limit * 1024 * 1024;
}

async function getCacheSize(cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    let totalSize = 0;
    // Process sequentially to avoid memory spikes on low-memory devices
    for (const request of keys) {
      try {
        const response = await cache.match(request);
        if (!response) continue;
        // Prefer arrayBuffer for binary-safe size
        const buffer = await response.clone().arrayBuffer();
        totalSize += buffer.byteLength || 0;
      } catch (err) {
        // skip problematic entries
      }
    }
    return totalSize;
  } catch (err) {
    console.warn('[SW] getCacheSize error', err);
    return 0;
  }
}

async function evictOldestEntries(cacheName, count = 5) {
  try {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    const entries = await Promise.all(requests.map(async request => {
      const response = await cache.match(request);
      const cachedAt = parseInt(response?.headers.get('sw-cached-at') || '0', 10) || 0;
      return { request, cachedAt };
    }));
    entries.sort((a, b) => a.cachedAt - b.cachedAt);
    const toEvict = entries.slice(0, Math.min(count, entries.length));
    for (const entry of toEvict) {
      await cache.delete(entry.request);
    }
    console.log(`[SW] Evicted ${toEvict.length} entries from ${cacheName}`);
  } catch (err) {
    console.warn('[SW] evictOldestEntries error', err);
  }
}

function updateCacheInBackground(request, cacheName) {
  // Fire-and-forget update to refresh cached content
  fetch(request).then(async response => {
    if (response && response.ok) {
      await cacheResponse(cacheName, request, response.clone());
    }
  }).catch(() => {});
}

async function handleFetchError(request, error) {
  console.error('[SW] Fetch error:', request.url, error);
  const cached = await caches.match(request);
  if (cached) return cached;
  if (request.mode === 'navigate') {
    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) return offlinePage;
  }
  // enqueue unsafe methods for later processing (if client wants retry)
  try {
    if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
      queueRequest(request);
    }
  } catch (e) {
    // ignore
  }
  return new Response('Network error', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain' }
  });
}

function queueRequest(request) {
  try {
    if (requestQueue.length >= MAX_QUEUE_SIZE) requestQueue.shift();
    requestQueue.push({
      url: request.url,
      method: request.method,
      headers: [...request.headers.entries()],
      body: null, // Body can't be reliably read from fetch requests in SW without explicit intervention.
      timestamp: Date.now()
    });
  } catch (err) {
    console.warn('[SW] queueRequest error', err);
  }
}

async function processQueue() {
  const queueCopy = [...requestQueue];
  requestQueue = [];
  for (const req of queueCopy) {
    try {
      await fetch(req.url, { method: req.method, headers: new Headers(req.headers) });
      console.log('[SW] Processed queued request:', req.url);
    } catch {
      // push back for retry later
      requestQueue.push(req);
    }
  }
}

async function cleanupOldCaches() {
  const cachesToKeep = Object.values(CACHE_NAMES);
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => {
    if (!cachesToKeep.includes(name)) {
      console.log('[SW] Deleting old cache:', name);
      return caches.delete(name);
    }
    return Promise.resolve();
  }));
  // reset cache-size caches
  cacheSizeCache = {};
  lastSizeCheck = 0;
}

async function initializeDB() {
  // Placeholder for IndexedDB initialization if you want to persist metrics/queue beyond SW lifetime.
  console.log('[SW] IndexedDB initialized (placeholder)');
}

function isImageRequest(url) {
  // strip query string and hash for extension check
  try {
    const clean = url.split('?')[0].split('#')[0];
    return /\.(jpg|jpeg|png|gif|webp|svg|ico|avif)$/i.test(clean);
  } catch {
    return false;
  }
}

function isStaticAsset(url) {
  try {
    const cleanPath = new URL(url).pathname;
    // exact match for known static assets or extension-level check
    if (STATIC_ASSETS.some(asset => cleanPath === asset || cleanPath.endsWith(asset))) return true;
    return /\.(css|js|woff2?|ttf|eot|map)$/i.test(cleanPath);
  } catch {
    return /\.(css|js|woff2?|ttf|eot|map)$/i.test(url);
  }
}

function recordMetrics(startTime, fromCache) {
  try {
    const duration = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - startTime;
    const total = performanceMetrics.totalRequests || 1;
    // update average response time incrementally
    performanceMetrics.averageResponseTime = ((performanceMetrics.averageResponseTime * (total - 1)) + duration) / total;
    if (fromCache) performanceMetrics.cacheHits++;
    else performanceMetrics.cacheMisses++;
  } catch (err) {
    // swallow metric errors to avoid breaking fetch responses
  }
}

// Message handler
self.addEventListener('message', async event => {
  const { type, payload } = event.data || {};
  let response;
  try {
    switch (type) {
      case 'SKIP_WAITING':
        await self.skipWaiting();
        response = { success: true };
        break;
      case 'GET_VERSION':
        response = { version: VERSION, caches: Object.values(CACHE_NAMES) };
        break;
      case 'CLEAR_CACHE':
        await clearCache(payload?.cacheName);
        response = { success: true };
        break;
      case 'CACHE_STATS':
        response = await getCacheStats();
        break;
      case 'PERFORMANCE_METRICS':
        response = { ...performanceMetrics };
        break;
      case 'PROCESS_QUEUE':
        await processQueue();
        response = { success: true, remaining: requestQueue.length };
        break;
      case 'PREFETCH':
        await prefetchUrls(payload?.urls || []);
        response = { success: true };
        break;
      case 'WARMUP_CACHE':
        await warmupCache();
        response = { success: true };
        break;
      default:
        response = { error: 'Unknown message type' };
    }
  } catch (error) {
    response = { error: error.message || String(error) };
  }
  // Post back via MessagePort if present, otherwise postMessage to event source
  if (event.ports && event.ports[0]) {
    event.ports[0].postMessage(response);
  } else {
    event.source?.postMessage?.(response);
  }
});

async function clearCache(cacheName) {
  if (cacheName) {
    await caches.delete(cacheName);
    console.log('[SW] Cleared cache:', cacheName);
  } else {
    const names = await caches.keys();
    await Promise.all(names.map(name => caches.delete(name)));
    console.log('[SW] Cleared all caches');
  }
  cacheSizeCache = {};
  lastSizeCheck = 0;
}

async function getCacheStats() {
  const cacheNames = await caches.keys();
  const stats = { caches: {}, total: { entries: 0, size: 0 }, performance: { ...performanceMetrics }, queuedRequests: requestQueue.length };
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    const size = await getCacheSize(cacheName);
    stats.caches[cacheName] = {
      entries: keys.length,
      size,
      sizeFormatted: formatBytes(size),
      limit: CACHE_LIMITS_MB[cacheName] ? formatBytes(CACHE_LIMITS_MB[cacheName] * 1024 * 1024) : 'unlimited'
    };
    stats.total.entries += keys.length;
    stats.total.size += size;
  }
  stats.total.sizeFormatted = formatBytes(stats.total.size);
  return stats;
}

async function prefetchUrls(urls) {
  const cache = await caches.open(CACHE_NAMES.dynamic);
  await Promise.allSettled(urls.map(url =>
    fetch(url).then(response => {
      if (response && response.ok) return cache.put(url, response.clone());
      return null;
    }).catch(e => console.warn(`[SW] Prefetch failed: ${url}`, e))
  ));
  console.log('[SW] Prefetched', urls.length, 'URLs');
}

async function warmupCache() {
  await prefetchUrls([
    '/',
    '/index.html',
    '/styles.css',
    '/app.js'
  ]);
  console.log('[SW] Cache warmed up');
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

async function broadcastToClients(message) {
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) {
    client.postMessage(message);
  }
}

// Background sync support
self.addEventListener('sync', event => {
  if (event.tag === 'process-queue') {
    event.waitUntil(processQueue());
  }
});

// Push notification support
self.addEventListener('push', event => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon || '/icon-192x192.png',
        badge: data.badge || '/badge-72x72.png',
        tag: data.tag || 'dao-notification',
        data: data.url ? { url: data.url } : undefined,
        vibrate: [200, 100, 200],
        requireInteraction: data.requireInteraction || false,
        actions: data.actions || []
      })
    );
  } catch (error) {
    console.error('[SW] Push notification error:', error);
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientsList => {
      for (const client of clientsList) {
        try {
          if (client.url === url && 'focus' in client) return client.focus();
        } catch (e) { /* ignore cross-origin issues */ }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'cache-cleanup') {
    event.waitUntil(performMaintenance());
  }
});

async function performMaintenance() {
  console.log('[SW] Performing maintenance...');
  await Promise.all([cleanupExpiredCaches(), processQueue(), optimizeCaches()]);
  console.log('[SW] Maintenance complete');
}

async function cleanupExpiredCaches() {
  const cacheNames = await caches.keys();
  for (const cacheName of cacheNames) {
    try {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      const maxAge = CACHE_EXPIRY_MS[cacheName] || CACHE_EXPIRY_MS[CACHE_NAMES.dynamic];
      for (const request of requests) {
        const response = await cache.match(request);
        const cachedAt = response?.headers.get('sw-cached-at');
        if (cachedAt && Date.now() - parseInt(cachedAt, 10) > maxAge) {
          await cache.delete(request);
        }
      }
    } catch (err) {
      // ignore per-cache errors
    }
  }
}

async function optimizeCaches() {
  for (const cacheName of [CACHE_NAMES.dynamic, CACHE_NAMES.images, CACHE_NAMES.api]) {
    if (await isCacheFull(cacheName)) await evictOldestEntries(cacheName, 10);
  }
}

self.addEventListener('error', event => console.error('[SW] Error:', event.error));
self.addEventListener('unhandledrejection', event => console.error('[SW] Unhandled rejection:', event.reason));

console.log(`[SW v${VERSION}] Service Worker loaded successfully`);
