// Generates one placeholder "photo" per building as a simple SVG - an
// abstract building glyph on a category-coloured gradient, clearly watermarked
// so nobody mistakes it for the real thing. Ben supplies real photos later
// (docs/seismic-walk-tour-scope.md section 3/12); this just gives the UI
// something to render instead of a blank/initial-letter box in the meantime.
// Run: node scripts/build-placeholder-images.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BUILDINGS_PATH = fileURLToPath(new URL('../src/data/buildings.json', import.meta.url))
const OUT_DIR = fileURLToPath(new URL('../public/images/walk', import.meta.url))

const CATEGORY_COLORS = {
  heritage: ['#b45309', '#78350f'], // terracotta / brick
  civic: ['#17638f', '#0f3d59'], // brand blue
  commercial: ['#0f766e', '#0b4f4a'], // teal
  new_build: ['#6d28d9', '#4c1d95'], // violet
}
const DEFAULT_COLORS = ['#475569', '#1e293b']

function buildingGlyph() {
  // A simple abstract building silhouette with a few window squares.
  return `
    <g opacity="0.9">
      <rect x="300" y="180" width="200" height="300" fill="white" fill-opacity="0.14" />
      <rect x="330" y="210" width="30" height="30" fill="white" fill-opacity="0.3" />
      <rect x="385" y="210" width="30" height="30" fill="white" fill-opacity="0.3" />
      <rect x="440" y="210" width="30" height="30" fill="white" fill-opacity="0.3" />
      <rect x="330" y="260" width="30" height="30" fill="white" fill-opacity="0.3" />
      <rect x="385" y="260" width="30" height="30" fill="white" fill-opacity="0.3" />
      <rect x="440" y="260" width="30" height="30" fill="white" fill-opacity="0.3" />
      <rect x="330" y="310" width="30" height="30" fill="white" fill-opacity="0.3" />
      <rect x="385" y="310" width="30" height="30" fill="white" fill-opacity="0.3" />
      <rect x="440" y="310" width="30" height="30" fill="white" fill-opacity="0.3" />
      <rect x="330" y="360" width="30" height="30" fill="white" fill-opacity="0.3" />
      <rect x="385" y="360" width="30" height="30" fill="white" fill-opacity="0.3" />
      <rect x="440" y="360" width="30" height="30" fill="white" fill-opacity="0.3" />
      <rect x="380" y="410" width="40" height="70" fill="white" fill-opacity="0.4" />
    </g>
  `
}

function svgFor(building) {
  const [c1, c2] = CATEGORY_COLORS[building.category] ?? DEFAULT_COLORS
  const initial = building.name.charAt(0).toUpperCase()
  const gradId = `g-${building.id}`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" role="img" aria-label="Placeholder image for ${building.name}">
  <defs>
    <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}" />
      <stop offset="1" stop-color="${c2}" />
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#${gradId})" />
  ${buildingGlyph()}
  <text x="400" y="260" text-anchor="middle" font-family="DM Sans, Arial, sans-serif" font-size="220" font-weight="900" fill="white" fill-opacity="0.18">${initial}</text>
  <text x="24" y="572" font-family="Arial, sans-serif" font-size="20" font-weight="700" letter-spacing="2" fill="white" fill-opacity="0.55">PLACEHOLDER PHOTO</text>
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
