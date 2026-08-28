// Precomputes the pairwise walking distance/duration matrix for every
// building in src/data/buildings.json using OpenRouteService's matrix
// endpoint, and commits it as src/data/matrix.json (docs/seismic-walk-tour-scope.md
// section 5). Runs at author time, not per user - the client TSP solver
// (src/lib/tsp.ts) reads matrix.json instead of calling ORS itself.
//
// Requires ORS_API_KEY in the environment. Idempotent: skips the API call
// entirely if matrix.json already matches the current building id/coordinate
// set, so CI can run this on every build without burning ORS quota.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BUILDINGS_PATH = fileURLToPath(new URL('../src/data/buildings.json', import.meta.url))
const MATRIX_PATH = fileURLToPath(new URL('../src/data/matrix.json', import.meta.url))
const ORS_MATRIX_URL = 'https://api.openrouteservice.org/v2/matrix/foot-walking'

// Astro/Vite auto-load .env(.local) for import.meta.env, but this is a plain
// Node script run outside that pipeline (via `node scripts/build-matrix.mjs`),
// so it has to load them itself to see ORS_API_KEY locally. A real CI secret
// in process.env always wins over the file.
function loadDotEnvLocal() {
  for (const name of ['.env.local', '.env']) {
    const path = fileURLToPath(new URL(`../${name}`, import.meta.url))
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, 'utf-8').split('\n')) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
      if (!match) continue
      const [, key, rawValue] = match
      if (process.env[key] !== undefined) continue
      process.env[key] = rawValue.trim().replace(/^["']|["']$/g, '')
    }
  }
}
loadDotEnvLocal()

function fingerprint(buildings) {
  return buildings.map((b) => `${b.id}:${b.lat}:${b.lng}`).sort().join('|')
}

async function main() {
  const buildings = JSON.parse(readFileSync(BUILDINGS_PATH, 'utf-8'))
  const currentFingerprint = fingerprint(buildings)

  if (existsSync(MATRIX_PATH)) {
    const existing = JSON.parse(readFileSync(MATRIX_PATH, 'utf-8'))
    if (existing.fingerprint === currentFingerprint) {
      console.log('matrix.json is already up to date for the current building set - skipping ORS call.')
      return
    }
  }

  const apiKey = process.env.ORS_API_KEY
  if (!apiKey) {
    console.warn(
      'ORS_API_KEY not set - skipping matrix precompute. The app will use the in-browser haversine fallback ' +
        'until this is run with a key configured (see docs/seismic-walk-tour-scope.md section 5).'
    )
    return
  }

  const locations = buildings.map((b) => [b.lng, b.lat])
  const res = await fetch(ORS_MATRIX_URL, {
    method: 'POST',
    headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ locations, metrics: ['distance', 'duration'] }),
  })
  if (!res.ok) {
    throw new Error(`ORS matrix request failed: ${res.status} ${await res.text()}`)
  }
  const data = await res.json()

  const matrix = {
    fingerprint: currentFingerprint,
    ids: buildings.map((b) => b.id),
    distances: data.distances, // metres, [i][j]
    durations: data.durations, // seconds, [i][j]
  }

  writeFileSync(MATRIX_PATH, JSON.stringify(matrix, null, 2) + '\n')
  console.log(`Wrote walking matrix for ${buildings.length} buildings to ${MATRIX_PATH}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
