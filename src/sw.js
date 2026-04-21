var appVersion = '0.8';
var cacheName  = 'stodopidly-v' + appVersion;

var filesToCache = [
    '/',
    '/index.html',
    '/css/stodopidly.css',
    '/js/app.js',
    '/js/storage.js',
    '/manifest.json',
    '/icons/192x192.png',
    '/icons/512x512.png',
    '/icons/180x180.png'
];

// Install: pre-cache the app shell
self.addEventListener('install', function (e) {
    console.log('[SW] Install v' + appVersion);
    e.waitUntil(
        caches.open(cacheName).then(function (cache) {
            return cache.addAll(filesToCache);
        })
    );
    self.skipWaiting();
});

// Activate: evict any old versioned caches
self.addEventListener('activate', function (e) {
    e.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys
                    .filter(function (k) { return k !== cacheName; })
                    .map(function (k) { return caches.delete(k); })
            );
        }).then(function () {
            return self.clients.claim();
        })
    );
});

// Fetch: cache-first for app shell, network-first for everything else
self.addEventListener('fetch', function (e) {
    e.respondWith(
        caches.match(e.request, { ignoreSearch: true }).then(function (cached) {
            return cached || fetch(e.request);
        })
    );
});
