// Renders public/og-walk.png, the 1200x630 social preview for /walk/ (used
// when the tour link is shared for PCEE 2027), in the walk's PCEE palette.
// Rarely needs re-running - only if the wording or branding changes.
// Run: node scripts/build-walk-og.mjs
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../public/og-walk.png', import.meta.url))
const FONT = 'Montserrat, Segoe UI, Arial, Helvetica, sans-serif'

// A fixed seismograph trace across the lower band, echoing the page hero.
const trace = [
  [0, 520], [300, 520], [340, 512], [370, 530], [400, 500], [420, 548], [440, 470], [455, 580], [470, 440],
  [485, 600], [500, 462], [515, 566], [530, 495], [550, 535], [575, 510], [610, 524], [660, 518], [1200, 520],
].map(([x, y]) => `${x},${y}`).join(' ')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="0.6">
      <stop offset="0" stop-color="#2a0a12"/>
      <stop offset="0.6" stop-color="#652431"/>
      <stop offset="1" stop-color="#8f2f3a"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <polyline points="${trace}" fill="none" stroke="white" stroke-opacity="0.25" stroke-width="3" stroke-linejoin="round"/>
  <rect x="80" y="78" width="148" height="40" rx="6" fill="none" stroke="white" stroke-opacity="0.5" stroke-width="2"/>
  <text x="154" y="105" text-anchor="middle" font-family="${FONT}" font-size="20" font-weight="800" letter-spacing="2" fill="white">PCEE 2027</text>
  <text x="250" y="105" font-family="${FONT}" font-size="20" font-weight="700" letter-spacing="3" fill="white" fill-opacity="0.75">PACIFIC CONFERENCE ON EARTHQUAKE ENGINEERING</text>
  <text x="76" y="250" font-family="${FONT}" font-size="124" font-weight="800" fill="white">Seismic Walk</text>
  <text x="80" y="320" font-family="${FONT}" font-size="40" font-weight="600" fill="white" fill-opacity="0.9">A self-guided engineering tour of Ōtautahi Christchurch</text>
  <rect x="0" y="560" width="1200" height="70" fill="#1c1517"/>
  <text x="80" y="604" font-family="${FONT}" font-size="26" font-weight="700" fill="white">16-18 February 2027 · Te Pae, Christchurch</text>
  <text x="1120" y="604" text-anchor="end" font-family="${FONT}" font-size="24" font-weight="600" fill="white" fill-opacity="0.75">Powered by Seismic Shift</text>
</svg>`

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(OUT)
console.log(`Wrote ${OUT}`)
