// Wires the precomputed ORS walking matrix (src/data/matrix.json, produced
// by scripts/build-matrix.mjs) into the tsp.ts solver when it exists, and
// falls back to the haversine estimate otherwise - e.g. before an
// ORS_API_KEY has ever been configured, or for a node not in the matrix
// (the "my location" virtual start point).
import { estimatedWalkMeters, type LatLng } from './geo'
import type { RouteNode } from './tsp'

// Glob import so a missing matrix.json doesn't break the build - it's
// author-time generated and may not exist yet in every environment.
const matrixModules = import.meta.glob('../data/matrix.json', { eager: true }) as Record<
  string,
  { default: { ids: string[]; distances: number[][] } }
>
const matrixData = Object.values(matrixModules)[0]?.default ?? null

export function getWalkDistance(a: RouteNode & LatLng, b: RouteNode & LatLng): number {
  if (matrixData) {
    const i = matrixData.ids.indexOf(a.id)
    const j = matrixData.ids.indexOf(b.id)
    if (i !== -1 && j !== -1) return matrixData.distances[i][j]
  }
  return estimatedWalkMeters(a, b)
}

export const hasPrecomputedMatrix = matrixData !== null
