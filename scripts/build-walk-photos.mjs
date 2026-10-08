// Turns building photos dropped into public/images/walk/ into web-ready
// <id>.webp files: rotated per the camera's EXIF, scaled to fit 1400px (enough
// for the detail header on a 2x phone screen), metadata (incl. GPS) stripped,
// and compressed. The full-size original is moved to photos/walk-originals/
// (gitignored) so it never ships or bloats the repo history.
//
// File names are forgiving: "Turanga.JPG", "turanga.jpg.jpg" (Windows hiding
// the extension) and "te pae.png" all map to the id by lowercasing, dropping
// every extension and turning spaces/underscores into hyphens. A photo whose
// name matches no building id is still converted, with a warning.
//
// A file already named exactly <id>.webp is treated as finished and left
// alone. To replace a photo, drop the new one in under any accepted name; it
// overwrites the old .webp.
//
// scripts/build-buildings.mjs then picks <id>.webp up in place of the
// placeholder plate. Wired into `npm run build:data`, ahead of that script.
// Run: node scripts/build-walk-photos.mjs
import { readFileSync, readdirSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const IMAGES_DIR = fileURLToPath(new URL('../public/images/walk', import.meta.url))
const ORIGINALS_DIR = fileURLToPath(new URL('../photos/walk-originals', import.meta.url))
const BUILDINGS_PATH = fileURLToPath(new URL('../src/data/buildings.json', import.meta.url))

const INPUT_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'tif', 'tiff'])
const MAX_SIZE = 1400
const WEBP_QUALITY = 78

function idFor(fileName) {
  return fileName.split('.')[0].trim().toLowerCase().replace(/[\s_]+/g, '-')
}

function pending() {
  return readdirSync(IMAGES_DIR).filter((name) => {
    const ext = name.split('.').pop().toLowerCase()
    if (!INPUT_EXTENSIONS.has(ext)) return false
    return name !== `${idFor(name)}.webp`
  })
}

async function main() {
  const todo = pending()
  if (todo.length === 0) return

  // Imported only when there is work: sharp arrives as an optional
  // dependency of astro, so a CI install without it still builds fine.
  const { default: sharp } = await import('sharp')
  const knownIds = new Set(JSON.parse(readFileSync(BUILDINGS_PATH, 'utf-8')).map((b) => b.id))
  mkdirSync(ORIGINALS_DIR, { recursive: true })

  for (const name of todo) {
    const id = idFor(name)
    const src = `${IMAGES_DIR}/${name}`
    const out = `${IMAGES_DIR}/${id}.webp`
    const input = readFileSync(src)
    await sharp(input)
      .rotate()
      .resize(MAX_SIZE, MAX_SIZE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toFile(out)
    renameSync(src, `${ORIGINALS_DIR}/${name}`)

    const kb = (n) => `${Math.round(n / 1024)} KB`
    console.log(`Photo ${name} -> ${id}.webp (${kb(input.length)} -> ${kb(statSync(out).size)})`)
    if (!knownIds.has(id)) {
      console.warn(`  Warning: no building has the id "${id}" - check the file name.`)
    }
  }
}

main()
