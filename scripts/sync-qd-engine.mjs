// Copies the Quake Defender sizing engine in from the private
// seismicshift-pipeline repo. The engine's source isn't published in this
// public repo - src/lib/qdSizing.ts is gitignored and filled by this script
// before every dev/build run.
//
// Source, in order: $QD_ENGINE_SRC (deploy.yml points this at a checkout of
// the private repo), then a sibling checkout at ../seismicshift-pipeline.
// If neither exists but a previous copy does, that copy is kept with a
// warning, so dev still starts offline from the private repo.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dest = resolve(root, 'src/lib/qdSizing.ts')
const candidates = [
  process.env.QD_ENGINE_SRC,
  resolve(root, '../seismicshift-pipeline/qd-sizing/qdSizing.ts'),
].filter(Boolean).map((p) => resolve(root, p))

const src = candidates.find((p) => existsSync(p))
if (src) {
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(src, dest)
  console.log(`sync-qd-engine: copied ${src}`)
} else if (existsSync(dest)) {
  console.warn('sync-qd-engine: private engine source not found - keeping the existing src/lib/qdSizing.ts, which may be stale')
} else {
  console.error(
    'sync-qd-engine: src/lib/qdSizing.ts is missing and no source was found.\n' +
    'Check out benexton/seismicshift-pipeline next to this repo, or set QD_ENGINE_SRC to its qd-sizing/qdSizing.ts.'
  )
  process.exit(1)
}
