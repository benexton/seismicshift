import sharp from 'sharp'
import { readdir, stat } from 'fs/promises'
import { join, extname, basename } from 'path'

const PUBLIC_DIR = new URL('../public/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')

const IMAGES = [
  // Large hero/section images — resize to max 1200px wide
  { file: 'pisa1website.jpg',   width: 1200 },
  { file: 'pisa2website.jpg',   width: 1200 },
  { file: 'ffinstall.jpg',      width: 1200 },
  { file: 'rolleston.jpg',      width: 1200 },
  { file: 'founderswebsite.jpeg', width: 800 },
  // Card images — 800px is more than enough
  { file: 'clean5.png',         width: 800 },
  { file: 'testingflag.png',    width: 800 },
  { file: 'qdhelp1.png',        width: 800 },
  { file: 'qdhelp2.png',        width: 800 },
  { file: 'qdhelp3.png',        width: 800 },
  { file: 'help1.png',          width: 800 },
  { file: 'help2.png',          width: 800 },
  { file: 'help3.png',          width: 800 },
  { file: 'Plinth.png',         width: 600 },
]

async function fileSize(path) {
  try { return (await stat(path)).size } catch { return 0 }
}

function kb(bytes) { return (bytes / 1024).toFixed(0) + ' KB' }

for (const { file, width } of IMAGES) {
  const input = join(PUBLIC_DIR, file)
  const output = join(PUBLIC_DIR, basename(file, extname(file)) + '.webp')

  const beforeSize = await fileSize(input)
  if (!beforeSize) { console.log(`⚠  Skipping ${file} (not found)`); continue }

  await sharp(input)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(output)

  const afterSize = await fileSize(output)
  const pct = Math.round((1 - afterSize / beforeSize) * 100)
  console.log(`✓  ${file.padEnd(28)} ${kb(beforeSize).padStart(9)} → ${kb(afterSize).padStart(9)} WebP  (${pct}% smaller)`)
}

console.log('\nDone. Update image src references from .jpg/.png → .webp')
