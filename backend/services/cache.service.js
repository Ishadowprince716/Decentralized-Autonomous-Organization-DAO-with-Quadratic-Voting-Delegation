/**
 * Cache Service
 * In-memory caching for API responses
 */

class CacheService {
    constructor() {
        this.cache = new Map();
        this.ttls = new Map();
    }

    /**
     * Set cache value with TTL
     * @param {string} key - Cache key
     * @param {any} value - Value to cache
     * @param {number} ttl - Time to live in seconds
     */
    set(key, value, ttl = 60) {
        this.cache.set(key, value);
        
        // Clear existing timeout
        if (this.ttls.has(key)) {
            clearTimeout(this.ttls.get(key));
        }
        
        // Set new timeout
        const timeout = setTimeout(() => {
            this.delete(key);
        }, ttl * 1000);
        
        this.ttls.set(key, timeout);
    }

    /**
     * Get cache value
     * @param {string} key - Cache key
     * @returns {any} Cached value or undefined
     */
    get(key) {
        return this.cache.get(key);
    }

    /**
     * Delete cache entry
     * @param {string} key - Cache key
     */
    delete(key) {
        if (this.ttls.has(key)) {
            clearTimeout(this.ttls.get(key));
            this.ttls.delete(key);
        }
        this.cache.delete(key);
    }

    /**
     * Clear all cache entries matching pattern
     * @param {string} pattern - Key pattern to match
     */
    clear(pattern) {
        if (pattern) {
            const keys = Array.from(this.cache.keys());
            keys.forEach(key => {
                if (key.includes(pattern)) {
                    this.delete(key);
                }
            });
        } else {
            // Clear all
            this.ttls.forEach(timeout => clearTimeout(timeout));
            this.cache.clear();
            this.ttls.clear();
        }
    }

    /**
     * Get cache size
     * @returns {number} Number of cached items
     */
    size() {
        return this.cache.size;
    }

    /**
     * Check if key exists
     * @param {string} key - Cache key
     * @returns {boolean}
     */
    has(key) {
        return this.cache.has(key);
    }
}

module.exports = CacheService;