// Offline cache for /walk/. Registered with scope: '/walk/' in walk.astro, so
// it only ever controls the walk page - but a controlled page's subresource
// requests (its /_astro/ JS + CSS bundles, building images, fonts) also come
// through here, which is what lets the tour actually run offline.
//
// Pre-caches just the page itself (anything else listed here must exist, or
// cache.addAll rejects and the whole install fails - the old v1/v2 pre-cached
// a /data/buildings.json that was never published, so offline never worked).
// Everything else is cached on first use, stale-while-revalidate. Map tiles
// and the directions API aren't cached; offline, the itinerary still works
// with straight-line legs.
const CACHE_NAME = 'seismic-walk-v3'
const PRECACHE = ['/walk/']

const SAME_ORIGIN_PREFIXES = ['/walk', '/_astro/', '/images/walk/', '/logo.png', '/NZSEELogo.png', '/favicon']
const CROSS_ORIGIN_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('seismic-walk-') && k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

function shouldCache(url) {
  if (url.origin === self.location.origin) return SAME_ORIGIN_PREFIXES.some((p) => url.pathname.startsWith(p))
  return CROSS_ORIGIN_HOSTS.includes(url.hostname)
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (!shouldCache(url)) return

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      // ignoreSearch so a shared ?r= route link still opens offline.
      cache.match(event.request, { ignoreSearch: url.pathname.startsWith('/walk') }).then((cached) => {
        const network = fetch(event.request)
          .then((response) => {
            if (response.ok || response.type === 'opaque') cache.put(event.request, response.clone())
            return response
          })
          .catch(() => cached)
        return cached || network
      })
    )
  )
})
