// Converts src/data/buildings.csv -> src/data/buildings.json, validating the
// schema documented in docs/seismic-walk-tour-scope.md (section 3) as it goes.
// Run: node scripts/build-buildings.mjs (wired into `npm run build:data`).
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const CSV_PATH = fileURLToPath(new URL('../src/data/buildings.csv', import.meta.url))
const JSON_PATH = fileURLToPath(new URL('../src/data/buildings.json', import.meta.url))

const REQUIRED_FIELDS = ['id', 'name', 'address', 'lat', 'lng', 'access_level', 'summary']
const ACCESS_LEVELS = new Set(['interior_public', 'foyer_only', 'exterior_only', 'by_arrangement'])
const NUMBER_FIELDS = new Set(['lat', 'lng', 'year_built', 'year_retrofit', 'storeys'])
const BOOLEAN_FIELDS = new Set(['step_free', 'featured'])
const LIST_FIELDS = new Set(['structural_tags'])

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  const pushField = () => { row.push(field); field = '' }
  const pushRow = () => { pushField(); rows.push(row); row = [] }

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else {
        field += c
      }
      continue
    }
    if (c === '"') { inQuotes = true; continue }
    if (c === ',') { pushField(); continue }
    if (c === '\r') continue
    if (c === '\n') { pushRow(); continue }
    field += c
  }
  if (field.length > 0 || row.length > 0) pushRow()
  return rows.filter((r) => !(r.length === 1 && r[0] === ''))
}

function coerce(key, raw) {
  const value = raw.trim()
  if (value === '') {
    if (LIST_FIELDS.has(key)) return []
    if (BOOLEAN_FIELDS.has(key)) return null
    return null
  }
  if (NUMBER_FIELDS.has(key)) {
    const n = Number(value)
    if (Number.isNaN(n)) throw new Error(`Field "${key}" is not a number: "${value}"`)
    return n
  }
  if (BOOLEAN_FIELDS.has(key)) {
    const upper = value.toUpperCase()
    if (upper !== 'TRUE' && upper !== 'FALSE') {
      throw new Error(`Field "${key}" must be TRUE/FALSE, got "${value}"`)
    }
    return upper === 'TRUE'
  }
  if (LIST_FIELDS.has(key)) {
    return value.split(';').map((s) => s.trim()).filter(Boolean)
  }
  return value
}

function main() {
  const csv = readFileSync(CSV_PATH, 'utf-8')
  const rows = parseCsv(csv)
  if (rows.length < 2) throw new Error('buildings.csv has no data rows')

  const header = rows[0].map((h) => h.trim())
  const dataRows = rows.slice(1)

  const seenIds = new Set()
  const buildings = dataRows.map((rawRow, idx) => {
    const lineNo = idx + 2 // +1 for header, +1 for 1-indexing
    if (rawRow.length !== header.length) {
      throw new Error(`Row ${lineNo}: expected ${header.length} columns, got ${rawRow.length}`)
    }
    const building = {}
    header.forEach((key, colIdx) => {
      building[key] = coerce(key, rawRow[colIdx])
    })

    for (const field of REQUIRED_FIELDS) {
      const v = building[field]
      if (v === null || v === undefined || v === '') {
        throw new Error(`Row ${lineNo} (${building.id || '?'}): missing required field "${field}"`)
      }
    }
    if (!ACCESS_LEVELS.has(building.access_level)) {
      throw new Error(
        `Row ${lineNo} (${building.id}): access_level "${building.access_level}" is not one of ${[...ACCESS_LEVELS].join(', ')}`
      )
    }
    if (seenIds.has(building.id)) {
      throw new Error(`Row ${lineNo}: duplicate id "${building.id}"`)
    }
    seenIds.add(building.id)

    return building
  })

  writeFileSync(JSON_PATH, JSON.stringify(buildings, null, 2) + '\n')
  console.log(`Wrote ${buildings.length} buildings to ${JSON_PATH}`)
}

main()
