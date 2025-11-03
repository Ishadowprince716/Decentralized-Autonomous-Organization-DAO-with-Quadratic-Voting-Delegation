// Enhanced Service Worker v2.1.0 with Advanced Caching and Performance Optimizations
// sw.js

const VERSION = '2.1.0';
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

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  // Add all other critical static assets here
];

const STRATEGY_MAP = new Map([
  ['rpc.test2.btcs.network', 'networkFirst'],
  ['scan.test2.btcs.network', 'networkFirst'],
  ['api.', 'networkFirst'],
  ['cdn.jsdelivr.net', 'cacheFirst'],
  ['cdnjs.cloudflare.com', 'cacheFirst'],
  ['fonts.googleapis.com', 'cacheFirst'],
  ['fonts.gstatic.com', 'cacheFirst']
]);

let requestQueue = [];
const MAX_QUEUE_SIZE = 100;

const performanceMetrics = {
  cacheHits: 0,
  cacheMisses: 0,
  networkRequests: 0,
  averageResponseTime: 0
};

self.addEventListener('install', event => {
  console.log(`[SW v${VERSION}] Installing...`);
  event.waitUntil(
    caches.open(CACHE_NAMES.static)
      .then(cache => Promise.allSettled(STATIC_ASSETS.map(url => cache.add(url).catch(e => console.warn(`[SW] Failed to cache ${url}`, e)))))
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
  if (request.method !== 'GET' || !request.url.startsWith('http') || request.headers.get('cache-control') === 'no-cache') {
    return;
  }

  const startTime = performance.now();
  const strategy = determineStrategy(request.url);
  event.respondWith(
    handleRequest(request, strategy)
      .then(response => { recordMetrics(startTime, strategy !== 'networkFirst'); return response; })
      .catch(error => handleFetchError(request, error))
  );
});

function determineStrategy(url) {
  const urlObj = new URL(url);
  if (isImageRequest(url)) return 'cacheFirst';
  if (urlObj.pathname.includes('/api/')) return 'networkFirst';
  for (const [pattern, strategy] of STRATEGY_MAP) {
    if (url.includes(pattern)) return strategy;
  }
  if (isStaticAsset(url)) return 'cacheOnly';
  return 'staleWhileRevalidate';
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
    const response = await Promise.race([fetch(request), timeoutPromise(timeout)]);
    if (response?.ok) {
      await cacheResponse(cacheName, request, response.clone());
      performanceMetrics.networkRequests++;
      return response;
    }
  } catch {}
  const cached = await getCachedResponse(cacheName, request);
  if (cached) {
    performanceMetrics.cacheHits++;
    return cached;
  }
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
    updateCacheInBackground(request, cacheName);
    return cached;
  }
  performanceMetrics.cacheMisses++;
  const response = await fetch(request);
  if (response?.ok) await cacheResponse(cacheName, request, response.clone());
  return response;
}

async function cacheOnly(request) {
  const cached = await caches.match(request);
  if (cached) {
    performanceMetrics.cacheHits++;
    return cached;
  }
  performanceMetrics.cacheMisses++;
  try {
    const response = await fetch(request);
    if (response?.ok) {
      const cache = await caches.open(CACHE_NAMES.static);
      await cache.put(request, response.clone());
      return response;
    }
  } catch {}
  return new Response('Not found', { status: 404 });
}

async function staleWhileRevalidate(request) {
  const cacheName = CACHE_NAMES.dynamic;
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(async response => {
    if (response?.ok) await cacheResponse(cacheName, request, response.clone());
    return response;
  }).catch(() => cached);
  if (cached) {
    performanceMetrics.cacheHits++;
    return cached;
  }
  performanceMetrics.cacheMisses++;
  return fetchPromise;
}

function getCacheNameForRequest(request) {
  if (isImageRequest(request.url)) return CACHE_NAMES.images;
  if (request.url.includes('/api/')) return CACHE_NAMES.api;
  if (isStaticAsset(request.url)) return CACHE_NAMES.static;
  return CACHE_NAMES.dynamic;
}

async function cacheResponse(cacheName, request, response) {
  if (await isCacheFull(cacheName)) await evictOldestEntries(cacheName);
  const cache = await caches.open(cacheName);
  const headers = new Headers(response.headers);
  headers.set('sw-cached-at', Date.now().toString());
  const modifiedResponse = new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  await cache.put(request, modifiedResponse);
}

async function getCachedResponse(cacheName, request) {
  const cache = await caches.open(cacheName);
  const response = await cache.match(request);
  if (!response) return null;
  const cachedAt = response.headers.get('sw-cached-at');
  if (cachedAt) {
    const age = Date.now() - parseInt(cachedAt);
    const maxAge = CACHE_EXPIRY_MS[cacheName] ?? CACHE_EXPIRY_MS[CACHE_NAMES.dynamic];
    if (age > maxAge) {
      await cache.delete(request);
      return null;
    }
  }
  return response;
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
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  let totalSize = 0;
  for (const request of keys) {
    const response = await cache.match(request);
    if (response) {
      try {
        const blob = await response.clone().blob();
        totalSize += blob.size;
      } catch {}
    }
  }
  return totalSize;
}

async function evictOldestEntries(cacheName, count = 5) {
  const cache = await caches.open(cacheName);
  const requests = await cache.keys();
  const entries = await Promise.all(requests.map(async request => {
    const response = await cache.match(request);
    const cachedAt = parseInt(response?.headers.get('sw-cached-at') || '0');
    return { request, cachedAt };
  }));
  entries.sort((a, b) => a.cachedAt - b.cachedAt);
  for (let i = 0; i < Math.min(count, entries.length); i++) {
    await cache.delete(entries[i].request);
  }
  console.log(`[SW] Evicted ${count} entries from ${cacheName}`);
}

function updateCacheInBackground(request, cacheName) {
  fetch(request).then(async response => {
    if (response?.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response);
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
  if (['POST', 'PUT', 'DELETE'].includes(request.method)) queueRequest(request);
  return new Response('Network error', { status: 503, statusText: 'Service Unavailable', headers: { 'Content-Type': 'text/plain' } });
}

function queueRequest(request) {
  if (requestQueue.length >= MAX_QUEUE_SIZE) requestQueue.shift();
  requestQueue.push({
    url: request.url,
    method: request.method,
    headers: [...request.headers.entries()],
    timestamp: Date.now()
  });
}

async function processQueue() {
  const queueCopy = [...requestQueue];
  requestQueue = [];
  for (const req of queueCopy) {
    try {
      await fetch(req.url, { method: req.method, headers: new Headers(req.headers) });
      console.log('[SW] Processed queued request:', req.url);
    } catch {
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
  }));
}

async function initializeDB() {
  // Setup IndexedDB if needed
  console.log('[SW] IndexedDB initialized');
}

function isImageRequest(url) {
  return /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(url);
}

function isStaticAsset(url) {
  return STATIC_ASSETS.some(asset => url.endsWith(asset)) || /\.(css|js|woff2?|ttf|eot)$/i.test(url);
}

function recordMetrics(startTime, fromCache) {
  const duration = performance.now() - startTime;
  const count = performanceMetrics.cacheHits + performanceMetrics.cacheMisses || 1;
  performanceMetrics.averageResponseTime = (performanceMetrics.averageResponseTime * (count - 1) + duration) / count;
}

// Message handler
self.addEventListener('message', async event => {
  const { type, payload } = event.data || {};
  let response;
  try {
    switch (type) {
      case 'SKIP_WAITING':
        self.skipWaiting();
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
    response = { error: error.message };
  }
  event.ports?.[0]?.postMessage(response);
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
  await Promise.allSettled(urls.map(url => fetch(url).then(response => response?.ok ? cache.put(url, response) : null).catch(e => console.warn(`[SW] Prefetch failed: ${url}`, e))));
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
  if (bytes === 0) return '0 Bytes';
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
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
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
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    const maxAge = CACHE_EXPIRY_MS[cacheName] || CACHE_EXPIRY_MS[CACHE_NAMES.dynamic];
    for (const request of requests) {
      const response = await cache.match(request);
      const cachedAt = response?.headers.get('sw-cached-at');
      if (cachedAt && Date.now() - parseInt(cachedAt) > maxAge) await cache.delete(request);
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
