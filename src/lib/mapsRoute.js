// Builds Google Maps walking-route URLs that open a whole walk, every stop
// pre-loaded, so people can follow it turn by turn in the Maps app (which also
// reroutes when they wander off the planned path).
//
// Google's Maps URLs docs (checked 2026-11-20): "up to three waypoints
// supported on mobile browsers, and a maximum of nine waypoints supported
// otherwise". We use 9: most phones open the link in the Google Maps app,
// and RouteActions tells phone users to have the app installed. A longer walk
// is split into consecutive parts that share their join point; each part is
// its own link.
const MAX_WAYPOINTS = 9

// Stops are sent as "name, address, Christchurch" text rather than raw
// coordinates: given coordinates, Google labels each stop with whatever
// business is nearest (Te Pae showed as "Mutual Fund House"). Every stop's
// text was checked against Google Maps search on 2026-11-20; these four
// didn't resolve to a single place as name + address, so they have their own
// wording. A point with no address (the walker's live location) stays as
// coordinates.
const QUERY_OVERRIDES = {
  'christ-church-cathedral': 'ChristChurch Cathedral, Christchurch',
  'earthquake-memorial': 'Canterbury Earthquake National Memorial, Christchurch',
  'christchurch-hospital-waipapa': 'Waipapa, Christchurch Hospital, Christchurch',
  ogb: 'OGB Bar, Cathedral Square, Christchurch',
}

const place = (p) => {
  if (QUERY_OVERRIDES[p.id]) return QUERY_OVERRIDES[p.id]
  if (p.name && p.address) return `${p.name}, ${p.address}, Christchurch`
  return `${p.lat},${p.lng}`
}

// Whether the walk is running as an installed home-screen app on an iPhone or
// iPad. There, iOS doesn't hand google.com/maps links to the Google Maps app
// (it shows Google's web page in an overlay instead), and a "new tab" can't
// reach anything the page made itself, like the PDF.
export function isIosStandalone() {
  if (typeof window === 'undefined') return false
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone = navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches
  return ios && standalone
}

// Click handler for every Google Maps link on the walk. The links themselves
// are plain https://www.google.com/maps/dir/?api=1 links with target="_blank",
// which Google documents as "open the Google Maps app if it's installed,
// otherwise the browser" - that's what happens in Safari, Chrome and on
// Android. Only the installed iPhone app needs help: try the Google Maps
// app's own link (comgooglemapsurl://), and if the app hasn't taken over
// within a moment (not installed), open the web version in a new tab.
export function openMapsLink(event, url) {
  if (!isIosStandalone()) return // the plain link does the right thing
  event.preventDefault()
  let left = false
  const onHide = () => { if (document.visibilityState === 'hidden') left = true }
  document.addEventListener('visibilitychange', onHide)
  window.location.href = url.replace(/^https:\/\//, 'comgooglemapsurl://')
  setTimeout(() => {
    document.removeEventListener('visibilitychange', onHide)
    if (!left && document.visibilityState === 'visible') window.open(url, '_blank', 'noopener')
  }, 800)
}

// `points` are the ordered walk points, start first. When `loop` is set the
// walk returns to the first point.
export function mapsRouteUrls(points, loop, waypointLimit = MAX_WAYPOINTS) {
  const pts = loop && points.length > 1 ? [...points, points[0]] : points
  if (pts.length < 2) return []
  const perPart = waypointLimit + 2 // origin + waypoints + destination
  const urls = []
  for (let i = 0; i < pts.length - 1; i += perPart - 1) {
    const part = pts.slice(i, i + perPart)
    const params = new URLSearchParams({
      api: '1',
      origin: place(part[0]),
      destination: place(part[part.length - 1]),
      travelmode: 'walking',
    })
    if (part.length > 2) params.set('waypoints', part.slice(1, -1).map(place).join('|'))
    urls.push(`https://www.google.com/maps/dir/?${params.toString()}`)
  }
  return urls
}
