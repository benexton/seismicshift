// Generates one placeholder image per building as a simple SVG "plate" in the
// PCEE 2027 walk palette: category label, year built, and a seismograph trace
// whose shape is seeded from the building id, so each plate differs. It is
// clearly a graphic rather than a photo, so nobody mistakes it for the real
// building. Ben supplies real photos later (docs/seismic-walk-tour-scope.md
// section 3/12); point a building's `image` at the photo and these stop
// being used.
// Run: node scripts/build-placeholder-images.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BUILDINGS_PATH = fileURLToPath(new URL('../src/data/buildings.json', import.meta.url))
const OUT_DIR = fileURLToPath(new URL('../public/images/walk', import.meta.url))

const CATEGORIES = {
  heritage: { label: 'HERITAGE', colors: ['#7a3b2e', '#2e0f0c'] },
  civic: { label: 'CIVIC', colors: ['#652431', '#2a0a12'] },
  commercial: { label: 'COMMERCIAL', colors: ['#4f2a3f', '#1c1517'] },
  new_build: { label: 'REBUILD', colors: ['#b53232', '#3a0f1a'] },
  context: { label: 'CONTEXT', colors: ['#4a4245', '#1c1517'] },
  refreshments: { label: 'REFRESHMENTS', colors: ['#8a6a4a', '#2b1d14'] },
}
const DEFAULT_CATEGORY = { label: 'SITE', colors: ['#5b4a4e', '#1c1517'] }

// Small deterministic PRNG so a building's trace is stable between runs.
function rng(seedText) {
  let h = 2166136261
  for (const ch of seedText) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

function seismograph(id, calm) {
  const rand = rng(id)
  const burstAt = 220 + rand() * 360
  const points = []
  for (let x = 0; x <= 800; x += 8) {
    const d = Math.abs(x - burstAt)
    const amp = calm ? 2 : 4 + 150 * Math.exp(-((d / 70) ** 2))
    const y = 330 + (rand() - 0.5) * 2 * amp
    points.push(`${x},${y.toFixed(1)}`)
  }
  return points.join(' ')
}

function gridLines() {
  const lines = []
  for (let x = 40; x < 800; x += 40) lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="600" />`)
  for (let y = 40; y < 600; y += 40) lines.push(`<line x1="0" y1="${y}" x2="800" y2="${y}" />`)
  return lines.join('')
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function svgFor(building) {
  const { label, colors: [c1, c2] } = CATEGORIES[building.category] ?? DEFAULT_CATEGORY
  const gradId = `g-${building.id}`
  // Context stops (memorials, exhibitions) and cafes/bars get a calm flat line
  // and no year.
  const calm = building.category === 'context' || building.category === 'refreshments'
  const year = !calm && building.year_built ? String(building.year_built) : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" role="img" aria-label="Illustration for ${escapeXml(building.name)}">
  <defs>
    <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}" />
      <stop offset="1" stop-color="${c2}" />
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#${gradId})" />
  <g stroke="white" stroke-opacity="0.06" stroke-width="1">${gridLines()}</g>
  <polyline points="${seismograph(building.id, calm)}" fill="none" stroke="white" stroke-opacity="0.55" stroke-width="3" stroke-linejoin="round" />
  <text x="400" y="110" text-anchor="middle" font-family="Montserrat, Arial, Helvetica, sans-serif" font-size="26" font-weight="700" letter-spacing="5" fill="white" fill-opacity="0.7">${label}</text>
  <text x="400" y="530" text-anchor="middle" font-family="Montserrat, Arial, Helvetica, sans-serif" font-size="130" font-weight="800" fill="white" fill-opacity="0.92">${year}</text>
</svg>
`
}

function main() {
  const buildings = JSON.parse(readFileSync(BUILDINGS_PATH, 'utf-8'))
  mkdirSync(OUT_DIR, { recursive: true })
  for (const building of buildings) {
    writeFileSync(`${OUT_DIR}/${building.id}.svg`, svgFor(building))
  }
  console.log(`Wrote ${buildings.length} placeholder images to ${OUT_DIR}`)
}

main()
