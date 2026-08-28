// Pulls every row from the walk_buildings Supabase table (the admin-editable
// source of truth maintained via /walkadmin/, see supabase/walk/schema.sql)
// and regenerates src/data/buildings.csv from it, in the exact column
// order/format scripts/build-buildings.mjs already expects. Wired into
// .github/workflows/walk_sync_and_deploy.yml, which runs this then
// `npm run build:data` and `npm run build:matrix` and commits whatever
// changed.
//
// Safety guard: aborts without writing if the fetch returns zero rows or
// errors, so a Supabase outage/misconfig can never silently wipe the
// checked-in CSV - the main defence (alongside the separate Google Sheets
// backup) against an admin-side accident clobbering good data.
//
// Env: WALK_SUPABASE_URL, WALK_SUPABASE_SERVICE_ROLE_KEY.
// Run: node scripts/sync-buildings-from-supabase.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const CSV_PATH = fileURLToPath(new URL('../src/data/buildings.csv', import.meta.url))

// Must match scripts/build-buildings.mjs's header exactly - that script
// treats this order as the buildings.csv contract.
const COLUMNS = [
  'id', 'name', 'name_mi', 'address', 'lat', 'lng', 'access_level', 'access_notes',
  'year_built', 'year_retrofit', 'structural_tags', 'summary', 'story', 'engineer',
  'architect', 'storeys', 'step_free', 'image', 'external_url', 'category', 'featured',
  'image_credit',
]
const BOOLEAN_FIELDS = new Set(['step_free', 'featured'])
const LIST_FIELDS = new Set(['structural_tags'])

// Same .env(.local) loader as scripts/build-matrix.mjs - a plain Node script
// run outside the Astro/Vite pipeline, so it has to load these itself.
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

function csvField(raw) {
  const value = raw === null || raw === undefined ? '' : String(raw)
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function coerceOut(key, value) {
  if (value === null || value === undefined) return ''
  if (BOOLEAN_FIELDS.has(key)) return value ? 'TRUE' : 'FALSE'
  if (LIST_FIELDS.has(key)) return Array.isArray(value) ? value.join(';') : ''
  return value
}

async function main() {
  const url = (process.env.WALK_SUPABASE_URL ?? '').replace(/\/$/, '')
  const key = process.env.WALK_SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!url || !key) {
    throw new Error('Missing env: WALK_SUPABASE_URL, WALK_SUPABASE_SERVICE_ROLE_KEY')
  }

  const endpoint = `${url}/rest/v1/walk_buildings?select=*&order=sort_order.asc,name.asc`
  const res = await fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!res.ok) {
    throw new Error(`Fetch failed [${res.status}]: ${(await res.text()).slice(0, 300)}`)
  }
  const rows = await res.json()

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(
      'walk_buildings returned zero rows - refusing to overwrite buildings.csv. ' +
      'Check WALK_SUPABASE_URL/WALK_SUPABASE_SERVICE_ROLE_KEY and that the table has data.'
    )
  }

  const lines = [COLUMNS.join(',')]
  for (const row of rows) {
    lines.push(COLUMNS.map((key) => csvField(coerceOut(key, row[key]))).join(','))
  }

  writeFileSync(CSV_PATH, lines.join('\n') + '\n')
  console.log(`Wrote ${rows.length} buildings to ${CSV_PATH}`)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
