// Builds Google Maps walking-route URLs that open a whole walk, every stop
// pre-loaded, so people can follow it turn by turn in the Maps app (which also
// reroutes when they wander off the planned path).
//
// Maps URLs allow a limited number of waypoints (9, per Google's Maps URLs
// documentation), so a long walk is split into consecutive parts that share
// their join point. Each part is its own link.
const MAX_POINTS = 11 // origin + 9 waypoints + destination

const coord = (p) => `${p.lat},${p.lng}`

// `points` are the ordered walk points, start first. When `loop` is set the
// walk returns to the first point.
export function mapsRouteUrls(points, loop) {
  const pts = loop && points.length > 1 ? [...points, points[0]] : points
  if (pts.length < 2) return []
  const urls = []
  for (let i = 0; i < pts.length - 1; i += MAX_POINTS - 1) {
    const part = pts.slice(i, i + MAX_POINTS)
    const params = new URLSearchParams({
      api: '1',
      origin: coord(part[0]),
      destination: coord(part[part.length - 1]),
      travelmode: 'walking',
    })
    if (part.length > 2) params.set('waypoints', part.slice(1, -1).map(coord).join('|'))
    urls.push(`https://www.google.com/maps/dir/?${params.toString()}`)
  }
  return urls
}
