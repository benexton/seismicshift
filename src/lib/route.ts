// Turns a solved stop order into a street-following polyline by calling the
// Cloudflare Worker that proxies OpenRouteService directions (see
// workers/directions.ts). Falls back to null on any failure so the caller
// can draw straight legs instead - the tour must stay usable offline or if
// the provider is down (docs/seismic-walk-tour-scope.md section 5).
import type { LatLng } from './geo'

const WORKER_URL = import.meta.env.PUBLIC_DIRECTIONS_WORKER_URL

export async function fetchRouteGeometry(points: LatLng[]): Promise<LatLng[] | null> {
  if (!WORKER_URL || points.length < 2) return null

  try {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coordinates: points.map((p) => [p.lng, p.lat]),
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const coords = data?.features?.[0]?.geometry?.coordinates
    if (!Array.isArray(coords)) return null
    return coords.map(([lng, lat]: [number, number]) => ({ lat, lng }))
  } catch {
    return null
  }
}
