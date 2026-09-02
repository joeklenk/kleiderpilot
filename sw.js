const CACHE_NAME = "kleiderpilot-1.1.1-shell-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./dashboard.css",
  "./dashboard.js",
  "./cloud.js",
  "./storage.js",
  "./rules.js",
  "./listing.js",
  "./images.js",
  "./app.webmanifest",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      // Network-first verhindert, dass PC/iPad nach einem GitHub-Update dauerhaft eine alte App-Version sehen.
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch {
      return (await cache.match(event.request)) || (await cache.match("./index.html"));
    }
  })());
});
