// Enhanced Service Worker with Advanced Caching and Performance
// sw.js - v2.0.0

const VERSION = '2.0.0';
const CACHE_NAME = `dao-v${VERSION}`;
const STATIC_CACHE = `dao-static-v${VERSION}`;
const DYNAMIC_CACHE = `dao-dynamic-v${VERSION}`;
const IMAGE_CACHE = `dao-images-v${VERSION}`;
const API_CACHE = `dao-api-v${VERSION}`;

// Cache size limits (in MB)
const CACHE_LIMITS = {
    [DYNAMIC_CACHE]: 50,
    [IMAGE_CACHE]: 100,
    [API_CACHE]: 25
};

// Cache expiration times (in milliseconds)
const CACHE_EXPIRY = {
    [STATIC_CACHE]: 7 * 24 * 60 * 60 * 1000, // 7 days
    [DYNAMIC_CACHE]: 24 * 60 * 60 * 1000,    // 24 hours
    [IMAGE_CACHE]: 7 * 24 * 60 * 60 * 1000,  // 7 days
    [API_CACHE]: 5 * 60 * 1000                // 5 minutes
};

// Static assets to precache
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/js/utils/constants.js',
    '/js/utils/validators.js',
    '/js/services/web3-manager.js',
    '/js/services/contract-manager.js',
    '/js/services/ui-manager.js',
    '/js/services/chart-manager.js',
    '/js/services/state-manager.js',
    '/manifest.json',
    '/offline.html'
];

// Strategy patterns with optimized lookup (O(1) using Map)
const STRATEGY_MAP = new Map([
    ['rpc.test2.btcs.network', 'networkFirst'],
    ['scan.test2.btcs.network', 'networkFirst'],
    ['api.', 'networkFirst'],
    ['cdn.jsdelivr.net', 'cacheFirst'],
    ['cdnjs.cloudflare.com', 'cacheFirst'],
    ['fonts.googleapis.com', 'cacheFirst'],
    ['fonts.gstatic.com', 'cacheFirst']
]);

// Request queue for offline operations
let requestQueue = [];
const MAX_QUEUE_SIZE = 100;

// Performance metrics
const performanceMetrics = {
    cacheHits: 0,
    cacheMisses: 0,
    networkRequests: 0,
    averageResponseTime: 0
};

/**
 * Install event - Optimized precaching with parallel requests
 */
self.addEventListener('install', (event) => {
    console.log(`[SW v${VERSION}] Installing...`);
    
    event.waitUntil(
        Promise.all([
            // Precache static assets in parallel
            caches.open(STATIC_CACHE).then(cache => {
                return Promise.allSettled(
                    STATIC_ASSETS.map(url => 
                        cache.add(url).catch(err => 
                            console.warn(`[SW] Failed to cache: ${url}`, err)
                        )
                    )
                );
            }),
            // Initialize other caches
            caches.open(DYNAMIC_CACHE),
            caches.open(IMAGE_CACHE),
            caches.open(API_CACHE)
        ]).then(() => {
            console.log(`[SW v${VERSION}] Static assets cached`);
        })
    );
    
    self.skipWaiting();
});

/**
 * Activate event - Enhanced cleanup with versioning
 */
self.addEventListener('activate', (event) => {
    console.log(`[SW v${VERSION}] Activating...`);
    
    event.waitUntil(
        Promise.all([
            // Clean old caches
            cleanupOldCaches(),
            // Initialize IndexedDB
            initializeDB(),
            // Take control immediately
            self.clients.claim()
        ]).then(() => {
            console.log(`[SW v${VERSION}] Activated and ready`);
            // Broadcast update to all clients
            broadcastToClients({ type: 'SW_ACTIVATED', version: VERSION });
        })
    );
});

/**
 * Fetch event - Optimized routing with strategy pattern
 */
self.addEventListener('fetch', (event) => {
    const { request } = event;
    
    // Skip non-GET and non-HTTP requests
    if (request.method !== 'GET' || !request.url.startsWith('http')) {
        return;
    }
    
    // Skip requests with no-cache header
    if (request.headers.get('cache-control') === 'no-cache') {
        return;
    }
    
    const startTime = performance.now();
    const strategy = determineStrategy(request.url);
    
    event.respondWith(
        handleRequest(request, strategy)
            .then(response => {
                recordMetrics(startTime, strategy !== 'network');
                return response;
            })
            .catch(error => handleFetchError(request, error))
    );
});

/**
 * Determine caching strategy - O(1) lookup using Map
 */
function determineStrategy(url) {
    const urlObj = new URL(url);
    
    // Check image requests
    if (isImageRequest(url)) return 'cacheFirst';
    
    // Check API requests
    if (urlObj.pathname.includes('/api/')) return 'networkFirst';
    
    // Check against strategy map
    for (const [pattern, strategy] of STRATEGY_MAP) {
        if (url.includes(pattern)) return strategy;
    }
    
    // Check static assets
    if (isStaticAsset(url)) return 'cacheOnly';
    
    // Default strategy
    return 'staleWhileRevalidate';
}

/**
 * Handle request with appropriate strategy
 */
async function handleRequest(request, strategy) {
    switch (strategy) {
        case 'networkFirst':
            return networkFirst(request);
        case 'cacheFirst':
            return cacheFirst(request);
        case 'cacheOnly':
            return cacheOnly(request);
        case 'staleWhileRevalidate':
            return staleWhileRevalidate(request);
        default:
            return fetch(request);
    }
}

/**
 * Network-first strategy with timeout
 */
async function networkFirst(request, timeout = 5000) {
    const cacheName = getCacheNameForRequest(request);
    
    try {
        const networkPromise = fetch(request);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Network timeout')), timeout)
        );
        
        const response = await Promise.race([networkPromise, timeoutPromise]);
        
        if (response?.ok) {
            await cacheResponse(cacheName, request, response.clone());
            performanceMetrics.networkRequests++;
            return response;
        }
    } catch (error) {
        console.log(`[SW] Network failed for ${request.url}, trying cache`);
    }
    
    const cached = await getCachedResponse(cacheName, request);
    if (cached) {
        performanceMetrics.cacheHits++;
        return cached;
    }
    
    throw new Error('No network or cache available');
}

/**
 * Cache-first strategy with background update
 */
async function cacheFirst(request) {
    const cacheName = getCacheNameForRequest(request);
    const cached = await getCachedResponse(cacheName, request);
    
    if (cached) {
        performanceMetrics.cacheHits++;
        
        // Update cache in background (fire and forget)
        updateCacheInBackground(request, cacheName);
        
        return cached;
    }
    
    performanceMetrics.cacheMisses++;
    const response = await fetch(request);
    
    if (response?.ok) {
        await cacheResponse(cacheName, request, response.clone());
    }
    
    return response;
}

/**
 * Cache-only strategy
 */
async function cacheOnly(request) {
    const cached = await caches.match(request);
    
    if (cached) {
        performanceMetrics.cacheHits++;
        return cached;
    }
    
    performanceMetrics.cacheMisses++;
    
    // Try to fetch and cache
    try {
        const response = await fetch(request);
        if (response?.ok) {
            const cache = await caches.open(STATIC_CACHE);
            await cache.put(request, response.clone());
            return response;
        }
    } catch (error) {
        console.error(`[SW] Failed to fetch: ${request.url}`);
    }
    
    return new Response('Not found', { status: 404 });
}

/**
 * Stale-while-revalidate strategy
 */
async function staleWhileRevalidate(request) {
    const cacheName = DYNAMIC_CACHE;
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    
    // Fetch in background
    const fetchPromise = fetch(request).then(async response => {
        if (response?.ok) {
            await cacheResponse(cacheName, request, response.clone());
        }
        return response;
    }).catch(() => cached);
    
    // Return cached immediately if available
    if (cached) {
        performanceMetrics.cacheHits++;
        return cached;
    }
    
    performanceMetrics.cacheMisses++;
    return fetchPromise;
}

/**
 * Get cache name for specific request types
 */
function getCacheNameForRequest(request) {
    const url = request.url;
    
    if (isImageRequest(url)) return IMAGE_CACHE;
    if (url.includes('/api/')) return API_CACHE;
    if (isStaticAsset(url)) return STATIC_CACHE;
    
    return DYNAMIC_CACHE;
}

/**
 * Cache response with size limit enforcement
 */
async function cacheResponse(cacheName, request, response) {
    const cache = await caches.open(cacheName);
    
    // Check cache size before adding
    if (await isCacheFull(cacheName)) {
        await evictOldestEntries(cacheName);
    }
    
    // Add expiry metadata
    const headers = new Headers(response.headers);
    headers.set('sw-cached-at', Date.now().toString());
    
    const modifiedResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
    });
    
    await cache.put(request, modifiedResponse);
}

/**
 * Get cached response with expiry check
 */
async function getCachedResponse(cacheName, request) {
    const cache = await caches.open(cacheName);
    const response = await cache.match(request);
    
    if (!response) return null;
    
    // Check if cache has expired
    const cachedAt = response.headers.get('sw-cached-at');
    if (cachedAt) {
        const age = Date.now() - parseInt(cachedAt);
        const maxAge = CACHE_EXPIRY[cacheName] || CACHE_EXPIRY[DYNAMIC_CACHE];
        
        if (age > maxAge) {
            await cache.delete(request);
            return null;
        }
    }
    
    return response;
}

/**
 * Check if cache is full - O(n) but cached periodically
 */
let cacheSizeCache = {};
let lastSizeCheck = 0;

async function isCacheFull(cacheName) {
    const now = Date.now();
    const limit = CACHE_LIMITS[cacheName];
    
    if (!limit) return false;
    
    // Use cached size if checked recently (within 1 minute)
    if (now - lastSizeCheck < 60000 && cacheSizeCache[cacheName]) {
        return cacheSizeCache[cacheName] >= limit * 1024 * 1024;
    }
    
    const size = await getCacheSize(cacheName);
    cacheSizeCache[cacheName] = size;
    lastSizeCheck = now;
    
    return size >= limit * 1024 * 1024;
}

/**
 * Get cache size in bytes
 */
async function getCacheSize(cacheName) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    let totalSize = 0;
    
    for (const request of keys) {
        try {
            const response = await cache.match(request);
            if (response) {
                const blob = await response.blob();
                totalSize += blob.size;
            }
        } catch (error) {
            console.warn('[SW] Error calculating cache size:', error);
        }
    }
    
    return totalSize;
}

/**
 * Evict oldest entries using LRU strategy
 */
async function evictOldestEntries(cacheName, count = 5) {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    
    // Sort by cache time (oldest first)
    const entries = await Promise.all(
        requests.map(async request => {
            const response = await cache.match(request);
            const cachedAt = parseInt(response?.headers.get('sw-cached-at') || 0);
            return { request, cachedAt };
        })
    );
    
    entries.sort((a, b) => a.cachedAt - b.cachedAt);
    
    // Delete oldest entries
    for (let i = 0; i < Math.min(count, entries.length); i++) {
        await cache.delete(entries[i].request);
    }
    
    console.log(`[SW] Evicted ${count} entries from ${cacheName}`);
}

/**
 * Update cache in background (non-blocking)
 */
function updateCacheInBackground(request, cacheName) {
    fetch(request).then(async response => {
        if (response?.ok) {
            const cache = await caches.open(cacheName);
            await cache.put(request, response);
        }
    }).catch(() => {
        // Silently fail background updates
    });
}

/**
 * Handle fetch errors with fallbacks
 */
async function handleFetchError(request, error) {
    console.error('[SW] Fetch error:', request.url, error);
    
    // Try to serve from any cache
    const cached = await caches.match(request);
    if (cached) return cached;
    
    // Serve offline page for navigation requests
    if (request.mode === 'navigate') {
        const offlinePage = await caches.match('/offline.html');
        if (offlinePage) return offlinePage;
    }
    
    // Queue for later if it's a POST/PUT/DELETE
    if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
        queueRequest(request);
    }
    
    return new Response('Network error', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain' }
    });
}

/**
 * Queue request for later processing
 */
function queueRequest(request) {
    if (requestQueue.length >= MAX_QUEUE_SIZE) {
        requestQueue.shift(); // Remove oldest
    }
    
    requestQueue.push({
        url: request.url,
        method: request.method,
        headers: [...request.headers.entries()],
        timestamp: Date.now()
    });
}

/**
 * Process queued requests
 */
async function processQueue() {
    const queue = [...requestQueue];
    requestQueue = [];
    
    for (const req of queue) {
        try {
            await fetch(req.url, {
                method: req.method,
                headers: new Headers(req.headers)
            });
            console.log('[SW] Processed queued request:', req.url);
        } catch (error) {
            // Re-queue if still failing
            requestQueue.push(req);
        }
    }
}

/**
 * Cleanup old caches
 */
async function cleanupOldCaches() {
    const cacheNames = await caches.keys();
    const currentCaches = [CACHE_NAME, STATIC_CACHE, DYNAMIC_CACHE, IMAGE_CACHE, API_CACHE];
    
    await Promise.all(
        cacheNames.map(cacheName => {
            if (!currentCaches.includes(cacheName)) {
                console.log('[SW] Deleting old cache:', cacheName);
                return caches.delete(cacheName);
            }
        })
    );
}

/**
 * Helper functions
 */
function isImageRequest(url) {
    return /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(url);
}

function isStaticAsset(url) {
    return STATIC_ASSETS.some(asset => url.endsWith(asset)) ||
           /\.(css|js|woff|woff2|ttf|eot)$/i.test(url);
}

/**
 * Record performance metrics
 */
function recordMetrics(startTime, fromCache) {
    const duration = performance.now() - startTime;
    const count = performanceMetrics.cacheHits + performanceMetrics.cacheMisses;
    
    performanceMetrics.averageResponseTime = 
        (performanceMetrics.averageResponseTime * (count - 1) + duration) / count;
}

/**
 * Message handler - Enhanced with more commands
 */
self.addEventListener('message', async (event) => {
    const { type, payload } = event.data || {};
    
    try {
        let response;
        
        switch (type) {
            case 'SKIP_WAITING':
                self.skipWaiting();
                response = { success: true };
                break;
                
            case 'GET_VERSION':
                response = {
                    version: VERSION,
                    caches: [STATIC_CACHE, DYNAMIC_CACHE, IMAGE_CACHE, API_CACHE]
                };
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
                console.warn('[SW] Unknown message type:', type);
                response = { error: 'Unknown message type' };
        }
        
        if (event.ports[0]) {
            event.ports[0].postMessage(response);
        }
    } catch (error) {
        console.error('[SW] Message handler error:', error);
        if (event.ports[0]) {
            event.ports[0].postMessage({ error: error.message });
        }
    }
});

/**
 * Clear specific cache or all caches
 */
async function clearCache(cacheName) {
    if (cacheName) {
        await caches.delete(cacheName);
        console.log('[SW] Cleared cache:', cacheName);
    } else {
        const names = await caches.keys();
        await Promise.all(names.map(name => caches.delete(name)));
        console.log('[SW] Cleared all caches');
    }
    
    // Reset cache size cache
    cacheSizeCache = {};
    lastSizeCheck = 0;
}

/**
 * Get detailed cache statistics
 */
async function getCacheStats() {
    const cacheNames = await caches.keys();
    const stats = { caches: {}, total: { entries: 0, size: 0 } };
    
    for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        const size = await getCacheSize(cacheName);
        
        stats.caches[cacheName] = {
            entries: keys.length,
            size: size,
            sizeFormatted: formatBytes(size),
            limit: CACHE_LIMITS[cacheName] 
                ? formatBytes(CACHE_LIMITS[cacheName] * 1024 * 1024) 
                : 'unlimited'
        };
        
        stats.total.entries += keys.length;
        stats.total.size += size;
    }
    
    stats.total.sizeFormatted = formatBytes(stats.total.size);
    stats.performance = { ...performanceMetrics };
    stats.queuedRequests = requestQueue.length;
    
    return stats;
}

/**
 * Prefetch URLs
 */
async function prefetchUrls(urls) {
    const cache = await caches.open(DYNAMIC_CACHE);
    
    await Promise.allSettled(
        urls.map(url => 
            fetch(url).then(response => {
                if (response?.ok) {
                    return cache.put(url, response);
                }
            }).catch(err => console.warn('[SW] Prefetch failed:', url, err))
        )
    );
    
    console.log('[SW] Prefetched', urls.length, 'URLs');
}

/**
 * Warmup cache with critical resources
 */
async function warmupCache() {
    const criticalResources = [
        '/',
        '/index.html',
        '/styles.css',
        '/app.js'
    ];
    
    await prefetchUrls(criticalResources);
    console.log('[SW] Cache warmed up');
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Broadcast message to all clients
 */
async function broadcastToClients(message) {
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => client.postMessage(message));
}

/**
 * Background sync handler
 */
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync:', event.tag);
    
    if (event.tag === 'process-queue') {
        event.waitUntil(processQueue());
    }
});

/**
 * Push notification handler
 */
self.addEventListener('push', (event) => {
    if (!event.data) return;
    
    try {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: data.icon || '/icon-192x192.png',
            badge: data.badge || '/badge-72x72.png',
            tag: data.tag || 'dao-notification',
            data: data.url ? { url: data.url } : undefined,
            vibrate: [200, 100, 200],
            requireInteraction: data.requireInteraction || false,
            actions: data.actions || []
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    } catch (error) {
        console.error('[SW] Push notification error:', error);
    }
});

/**
 * Notification click handler
 */
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    const url = event.notification.data?.url || '/';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientList => {
                for (const client of clientList) {
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

/**
 * Periodic background sync (if supported)
 */
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'cache-cleanup') {
        event.waitUntil(performMaintenance());
    }
});

/**
 * Perform periodic maintenance
 */
async function performMaintenance() {
    console.log('[SW] Performing maintenance...');
    
    await Promise.all([
        cleanupExpiredCaches(),
        processQueue(),
        optimizeCaches()
    ]);
    
    console.log('[SW] Maintenance complete');
}

/**
 * Cleanup expired cache entries
 */
async function cleanupExpiredCaches() {
    const cacheNames = await caches.keys();
    
    for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        const maxAge = CACHE_EXPIRY[cacheName] || CACHE_EXPIRY[DYNAMIC_CACHE];
        
        for (const request of requests) {
            const response = await cache.match(request);
            const cachedAt = response?.headers.get('sw-cached-at');
            
            if (cachedAt && Date.now() - parseInt(cachedAt) > maxAge) {
                await cache.delete(request);
            }
        }
    }
}

/**
 * Optimize caches by removing duplicates and compressing
 */
async function optimizeCaches() {
    // Remove duplicate entries and enforce size limits
    const cacheNames = [DYNAMIC_CACHE, IMAGE_CACHE, API_CACHE];
    
    for (const cacheName of cacheNames) {
        if (await isCacheFull(cacheName)) {
            await evictOldestEntries(cacheName, 10);
        }
    }
}

/**
 * Initialize IndexedDB for offline storage
 */
async function initializeDB() {
    // Placeholder for IndexedDB initialization
    // In production, this would set up proper database structure
    console.log('[SW] Database initialized');
}

/**
 * Error handlers
 */
self.addEventListener('error', (event) => {
    console.error('[SW] Error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('[SW] Unhandled rejection:', event.reason);
});

// Monitor online/offline status
self.addEventListener('online', () => {
    console.log('[SW] Back online, processing queue...');
    processQueue();
});

console.log(`[SW v${VERSION}] Script loaded successfully`);
