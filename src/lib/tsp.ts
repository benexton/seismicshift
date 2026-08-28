// Nearest-neighbour construction + 2-opt improvement for the walking route
// order. Operates over a small in-memory distance matrix built from whatever
// distance function is supplied (haversine fallback by default; a precomputed
// matrix.json lookup can be swapped in later - see section 5 of
// docs/seismic-walk-tour-scope.md). Near-instant at tour-sized selections
// (<= ~15 stops).
import { estimatedWalkMeters, type LatLng } from './geo'

export interface RouteNode extends LatLng {
  id: string
}

export interface RouteResult {
  order: string[]
  totalMeters: number
  legMeters: number[] // one entry per leg, in order; includes the closing leg when looped
}

export interface SolveOptions {
  startId?: string | null
  loop?: boolean
  getDistance?: (a: RouteNode, b: RouteNode) => number
}

function buildMatrix(nodes: RouteNode[], getDistance: (a: RouteNode, b: RouteNode) => number): number[][] {
  const n = nodes.length
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = getDistance(nodes[i], nodes[j])
      matrix[i][j] = d
      matrix[j][i] = d
    }
  }
  return matrix
}

function nearestNeighbourOrder(matrix: number[][], startIdx: number): number[] {
  const n = matrix.length
  const visited = new Array(n).fill(false)
  const order = [startIdx]
  visited[startIdx] = true
  let current = startIdx
  for (let step = 1; step < n; step++) {
    let best = -1
    let bestDist = Infinity
    for (let j = 0; j < n; j++) {
      if (!visited[j] && matrix[current][j] < bestDist) {
        bestDist = matrix[current][j]
        best = j
      }
    }
    order.push(best)
    visited[best] = true
    current = best
  }
  return order
}

function routeLength(matrix: number[][], order: number[], loop: boolean): number {
  let total = 0
  for (let i = 0; i < order.length - 1; i++) total += matrix[order[i]][order[i + 1]]
  if (loop && order.length > 1) total += matrix[order[order.length - 1]][order[0]]
  return total
}

// Reverses order[i+1..j] in place, keeping index 0 (the fixed start) untouched.
function twoOptImprove(matrix: number[][], initialOrder: number[], loop: boolean): number[] {
  let order = initialOrder.slice()
  const n = order.length
  if (n < 4) return order

  let improved = true
  while (improved) {
    improved = false
    for (let i = 0; i < n - 2; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1 && !loop) continue // reversing the whole path is a no-op for an open path
        const candidate = order.slice()
        const segment = candidate.slice(i + 1, j + 1).reverse()
        candidate.splice(i + 1, segment.length, ...segment)
        if (routeLength(matrix, candidate, loop) < routeLength(matrix, order, loop) - 1e-6) {
          order = candidate
          improved = true
        }
      }
    }
  }
  return order
}

export function solveRoute(nodes: RouteNode[], opts: SolveOptions = {}): RouteResult {
  const { startId = null, loop = false, getDistance = estimatedWalkMeters } = opts

  if (nodes.length === 0) return { order: [], totalMeters: 0, legMeters: [] }
  if (nodes.length === 1) return { order: [nodes[0].id], totalMeters: 0, legMeters: [] }

  const startIdx = startId ? Math.max(0, nodes.findIndex((n) => n.id === startId)) : 0
  const matrix = buildMatrix(nodes, getDistance)

  let order = nearestNeighbourOrder(matrix, startIdx)
  order = twoOptImprove(matrix, order, loop)

  const legMeters: number[] = []
  for (let i = 0; i < order.length - 1; i++) legMeters.push(matrix[order[i]][order[i + 1]])
  if (loop) legMeters.push(matrix[order[order.length - 1]][order[0]])

  return {
    order: order.map((idx) => nodes[idx].id),
    totalMeters: legMeters.reduce((a, b) => a + b, 0),
    legMeters,
  }
}
