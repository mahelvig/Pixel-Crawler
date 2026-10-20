"use strict";

// The service worker lets the game be installed and played without a connection. Files are fetched from the network first, so a
// new version of the game is picked up as soon as there is one, and the last copy that was fetched is used when offline.

const CACHE = 'pixel-crawler';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  event.respondWith(
    fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)); }
      return response;
    }).catch(() => caches.match(request, { ignoreSearch: true }).then(hit => hit || caches.match('index.html')))
  );
});
