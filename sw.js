// Service Worker for Caching and Performance
// sw.js

const CACHE_NAME = 'dao-v1.0.0';
const STATIC_CACHE = 'dao-static-v1.0.0';
const DYNAMIC_CACHE = 'dao-dynamic-v1.0.0';

// Files to cache immediately
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
    // External CDN resources
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Network-first resources (always try network, fallback to cache)
const NETWORK_FIRST = [
    'https://rpc.test2.btcs.network',
    'https://scan.test2.btcs.network'
];

// Cache-first resources (serve from cache, update in background)
const CACHE_FIRST = [
    'https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.umd.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js',
    'https://fonts.gstatic.com'
];

/**
 * Install event - Cache static assets
 */
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('Service Worker: Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .catch(error => {
                console.error('Service Worker: Failed to cache static assets:', error);
            })
    );
    
    // Force activation of new service worker
    self.skipWaiting();
});

/**
 * Activate event - Clean up old caches
 */
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                            console.log('Service Worker: Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            // Take control of all pages
            self.clients.claim()
        ])
    );
});

/**
 * Fetch event - Handle network requests with caching strategies
 */
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip chrome-extension and other protocols
    if (!request.url.startsWith('http')) {
        return;
    }
    
    // Apply appropriate caching strategy
    if (isNetworkFirst(request.url)) {
        event.respondWith(networkFirst(request));
    } else if (isCacheFirst(request.url)) {
        event.respondWith(cacheFirst(request));
    } else if (isStaticAsset(request.url)) {
        event.respondWith(cacheOnly(request));
    } else {
        event.respondWith(staleWhileRevalidate(request));
    }
});

/**
 * Network-first strategy - Try network, fallback to cache
 */
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse && networkResponse.status === 200) {
            // Cache successful responses
            const responseClone = networkResponse.clone();
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, responseClone);
        }
        
        return networkResponse;
    } catch (error) {
        console.log('Service Worker: Network failed, trying cache:', request.url);
        
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline fallback for important requests
        if (request.url.includes('rpc.test2.btcs.network')) {
            return new Response(
                JSON.stringify({ error: 'Network unavailable' }),
                {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }
        
        throw error;
    }
}

/**
 * Cache-first strategy - Serve from cache, update in background
 */
async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
        // Update cache in background
        fetch(request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
                caches.open(STATIC_CACHE).then(cache => {
                    cache.put(request, networkResponse);
                });
            }
        }).catch(() => {
            // Ignore network errors in background update
        });
        
        return cachedResponse;
    }
    
    // If not in cache, fetch from network
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, responseClone);
        }
        
        return networkResponse;
    } catch (error) {
        console.error('Service Worker: Failed to fetch:', request.url, error);
        throw error;
    }
}

/**
 * Cache-only strategy - Serve only from cache
 */
async function cacheOnly(request) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
        return cachedResponse;
    }
    
    // If static asset not in cache, try to fetch and cache it
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, responseClone);
            return networkResponse;
        }
    } catch (error) {
        console.error('Service Worker: Failed to fetch static asset:', request.url);
    }
    
    // Return 404 for missing static assets
    return new Response('Not found', { status: 404 });
}

/**
 * Stale-while-revalidate strategy - Serve from cache, update in background
 */
async function staleWhileRevalidate(request) {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    // Start fetching from network
    const fetchPromise = fetch(request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    }).catch(() => {
        // Return cached response if network fails
        return cachedResponse;
    });
    
    // Return cached response immediately if available, otherwise wait for network
    return cachedResponse || fetchPromise;
}

/**
 * Check if URL should use network-first strategy
 */
function isNetworkFirst(url) {
    return NETWORK_FIRST.some(pattern => url.includes(pattern));
}

/**
 * Check if URL should use cache-first strategy
 */
function isCacheFirst(url) {
    return CACHE_FIRST.some(pattern => url.includes(pattern));
}

/**
 * Check if URL is a static asset
 */
function isStaticAsset(url) {
    return STATIC_ASSETS.some(asset => {
        if (asset === '/' || asset === '/index.html') {
            return url.endsWith('/') || url.endsWith('/index.html') || url.endsWith('.html');
        }
        return url.includes(asset);
    });
}

/**
 * Message handler for communication with main thread
 */
self.addEventListener('message', (event) => {
    const { type, payload } = event.data || {};
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'GET_VERSION':
            event.ports[0].postMessage({
                version: CACHE_NAME,
                caches: [STATIC_CACHE, DYNAMIC_CACHE]
            });
            break;
            
        case 'CLEAR_CACHE':
            clearAllCaches().then(() => {
                event.ports[0].postMessage({ success: true });
            }).catch(error => {
                event.ports[0].postMessage({ success: false, error: error.message });
            });
            break;
            
        case 'CACHE_STATS':
            getCacheStats().then(stats => {
                event.ports[0].postMessage(stats);
            });
            break;
            
        default:
            console.log('Service Worker: Unknown message type:', type);
    }
});

/**
 * Clear all caches
 */
async function clearAllCaches() {
    const cacheNames = await caches.keys();
    await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
    );
    console.log('Service Worker: All caches cleared');
}

/**
 * Get cache statistics
 */
async function getCacheStats() {
    const cacheNames = await caches.keys();
    const stats = {};
    
    for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        stats[cacheName] = {
            count: keys.length,
            urls: keys.map(request => request.url)
        };
    }
    
    return stats;
}

/**
 * Background sync for offline actions
 */
self.addEventListener('sync', (event) => {
    console.log('Service Worker: Background sync:', event.tag);
    
    switch (event.tag) {
        case 'sync-votes':
            event.waitUntil(syncPendingVotes());
            break;
            
        case 'sync-proposals':
            event.waitUntil(syncPendingProposals());
            break;
            
        default:
            console.log('Service Worker: Unknown sync tag:', event.tag);
    }
});

/**
 * Sync pending votes when back online
 */
async function syncPendingVotes() {
    try {
        // Get pending votes from IndexedDB or localStorage
        const pendingVotes = await getPendingVotes();
        
        for (const vote of pendingVotes) {
            try {
                // Attempt to submit vote
                await submitVote(vote);
                await removePendingVote(vote.id);
                console.log('Service Worker: Synced pending vote:', vote.id);
            } catch (error) {
                console.error('Service Worker: Failed to sync vote:', vote.id, error);
            }
        }
    } catch (error) {
        console.error('Service Worker: Sync votes failed:', error);
    }
}

/**
 * Sync pending proposals when back online
 */
async function syncPendingProposals() {
    try {
        // Get pending proposals from IndexedDB or localStorage
        const pendingProposals = await getPendingProposals();
        
        for (const proposal of pendingProposals) {
            try {
                // Attempt to submit proposal
                await submitProposal(proposal);
                await removePendingProposal(proposal.id);
                console.log('Service Worker: Synced pending proposal:', proposal.id);
            } catch (error) {
                console.error('Service Worker: Failed to sync proposal:', proposal.id, error);
            }
        }
    } catch (error) {
        console.error('Service Worker: Sync proposals failed:', error);
    }
}

/**
 * Placeholder functions for offline data management
 * In a real implementation, these would interact with IndexedDB
 */
async function getPendingVotes() {
    // Implementation would read from IndexedDB
    return [];
}

async function getPendingProposals() {
    // Implementation would read from IndexedDB
    return [];
}

async function removePendingVote(id) {
    // Implementation would remove from IndexedDB
    console.log('Removing pending vote:', id);
}

async function removePendingProposal(id) {
    // Implementation would remove from IndexedDB
    console.log('Removing pending proposal:', id);
}

async function submitVote(vote) {
    // Implementation would submit vote to blockchain
    console.log('Submitting vote:', vote);
}

async function submitProposal(proposal) {
    // Implementation would submit proposal to blockchain
    console.log('Submitting proposal:', proposal);
}

/**
 * Push notification handler
 */
self.addEventListener('push', (event) => {
    console.log('Service Worker: Push message received');
    
    if (!event.data) {
        return;
    }
    
    try {
        const data = event.data.json();
        const { title, body, icon, badge, tag, actions } = data;
        
        const options = {
            body,
            icon: icon || '/icon-192x192.png',
            badge: badge || '/badge-72x72.png',
            tag: tag || 'dao-notification',
            actions: actions || [],
            vibrate: [200, 100, 200],
            data: data.url ? { url: data.url } : undefined,
            requireInteraction: data.requireInteraction || false
        };
        
        event.waitUntil(
            self.registration.showNotification(title, options)
        );
    } catch (error) {
        console.error('Service Worker: Push notification error:', error);
    }
});

/**
 * Notification click handler
 */
self.addEventListener('notificationclick', (event) => {
    console.log('Service Worker: Notification clicked');
    
    event.notification.close();
    
    const { action, data } = event;
    const url = data?.url || '/';
    
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(clientList => {
            // Check if app is already open
            for (const client of clientList) {
                if (client.url === url && 'focus' in client) {
                    return client.focus();
                }
            }
            
            // Open new window
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});

/**
 * Error handler
 */
self.addEventListener('error', (event) => {
    console.error('Service Worker: Error:', event.error);
});

/**
 * Unhandled rejection handler
 */
self.addEventListener('unhandledrejection', (event) => {
    console.error('Service Worker: Unhandled rejection:', event.reason);
});

console.log('Service Worker: Script loaded successfully');
