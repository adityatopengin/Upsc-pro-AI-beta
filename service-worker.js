// service-worker.js - PWA Service Worker for Offline Functionality and Caching

const CACHE_NAME = 'upsc-pro-cache-v1.2'; // Incrementing version for final deployment

// List of files to cache immediately upon installation (The App Shell)
const urlsToCache = [
    './', 
    './index.html',
    './db.js',
    './core.js',
    './ui-common.js',
    './page-quiz.js',
    './page-selection.js',
    './page-notes.js',
    './ai.js',
    './data/initial_questions.json',
    './offline.html', // NEW: The fallback page
    // External CDNs
    'https://cdn.tailwindcss.com', 
    'https://unpkg.com/dexie@latest/dist/dexie.js',
    'https://unpkg.com/flexsearch@0.7.3/dist/flexsearch.compact.js',
    'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
];

// 1. Installation: Caching the App Shell
self.addEventListener('install', event => {
    console.log('[Service Worker] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => {
            return cache.addAll(urlsToCache);
        }).catch(error => {
            console.error('[Service Worker] Failed to cache core assets:', error);
        })
    );
    self.skipWaiting();
});

// 2. Activation: Cleaning up old caches
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// 3. Fetch: Serving content from cache first (Cache-First Strategy)
self.addEventListener('fetch', event => {
    const isApiCall = event.request.url.includes('googleapis.com') || event.request.url.includes('gemini') || event.request.url.includes('firestore');
    
    if (isApiCall) {
        return; 
    }

    event.respondWith(
        caches.match(event.request)
        .then(response => {
            if (response) return response;

            return fetch(event.request).then(
                networkResponse => {
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                        return networkResponse;
                    }
                    
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                    return networkResponse;
                }
            ).catch(() => {
                // --- CRITICAL: Fallback to cached offline page ---
                console.error('[Service Worker] Final fallback to offline.html');
                return caches.match('./offline.html');
            });
        })
    );
});

