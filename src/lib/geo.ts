// Haversine distance + small formatting helpers shared by the route optimiser
// and the map/itinerary views. No network dependency - this is the fallback
// tier described in docs/seismic-walk-tour-scope.md section 5.

export interface LatLng {
  lat: number
  lng: number
}

const EARTH_RADIUS_M = 6371000

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

// Central-city streets aren't straight lines - nudge haversine up so the
// fallback estimate reads closer to an actual walking distance.
const STREET_FACTOR = 1.3
export function estimatedWalkMeters(a: LatLng, b: LatLng): number {
  return haversineMeters(a, b) * STREET_FACTOR
}

const WALK_SPEED_M_PER_MIN = 80 // ~4.8 km/h, comfortable sightseeing pace

export function walkMinutes(meters: number): number {
  return meters / WALK_SPEED_M_PER_MIN
}

export function boundsOf(points: LatLng[]): [[number, number], [number, number]] | null {
  if (points.length === 0) return null
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
  for (const p of points) {
    minLat = Math.min(minLat, p.lat)
    maxLat = Math.max(maxLat, p.lat)
    minLng = Math.min(minLng, p.lng)
    maxLng = Math.max(maxLng, p.lng)
  }
  return [[minLng, minLat], [maxLng, maxLat]]
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

export function formatDuration(minutes: number): string {
  const total = Math.round(minutes)
  if (total < 60) return `${total} min`
  const h = Math.floor(total / 60)
  const m = total % 60
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`
}
