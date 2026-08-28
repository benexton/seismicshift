// Minimal offline app-shell cache for /walk/. Scoped narrowly (registered
// with scope: '/walk/' in walk.astro) so it never intercepts the rest of the
// site. Caches the tour page itself plus the building data so the tour stays
// usable offline; tile/route-geometry caching can be layered on once the
// MapTiler/ORS keys are configured (docs/seismic-walk-tour-scope.md section 7).
const CACHE_NAME = 'seismic-walk-v1'
const APP_SHELL = ['/walk/', '/data/buildings.json']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/walk')) {
    if (!APP_SHELL.some((p) => url.pathname === p)) return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
          }
          return response
        })
        .catch(() => cached)
      return cached || fetchPromise
    })
  )
})
