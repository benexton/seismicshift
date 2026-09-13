// Converts docs/LiquefactionVulnerability.geojson (the Christchurch City
// Council / Tonkin & Taylor 2019 liquefaction vulnerability study, as
// exported from CCC's GIS) into the slim file the map actually serves.
// Two things this does that the raw export doesn't:
//   1. Maps the source's free-text Liq_Cat values onto the 5 stable bucket
//      keys in LIQUEFACTION_BUCKETS (src/lib/buildingStockAge.js) - kept in
//      sync with that list by hand (see the comment there for why "possible"
//      is its own bucket, not folded into "medium").
//   2. Strips every property except the bucket key + the handful used in the
//      popup, and rounds coordinates to 6 decimal places (~11cm, far finer
//      than this hazard mapping needs) - the raw file repeats several
//      paragraphs of report metadata (Author/Rept_Ref/Base_Inf/Uncert...) on
//      all 600 features, which is most of its 3MB and has no per-feature
//      value once the study is described once in the map's methodology note.
//
// Usage: node scripts/building-stock/build_liquefaction_geojson.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const IN_PATH = join(ROOT, 'docs', 'LiquefactionVulnerability.geojson');
const OUT_PATH = join(ROOT, 'public', 'data', 'liquefaction-vulnerability.geojson');

// Mirrors LIQUEFACTION_BUCKETS in src/lib/buildingStockAge.js.
const SOURCE_VALUE_TO_KEY = {
  'High Liquefaction Vulnerability': 'high',
  'Liquefaction Damage is Possible': 'possible',
  'Medium Liquefaction Vulnerability': 'medium',
  'Low Liquefaction Vulnerability': 'low',
  'Liquefaction Damage is Unlikely': 'unlikely',
};

function round6(n) { return Math.round(n * 1e6) / 1e6; }

function roundCoords(coords) {
  if (typeof coords[0] === 'number') return coords.map(round6);
  return coords.map(roundCoords);
}

const raw = JSON.parse(readFileSync(IN_PATH, 'utf8'));

const features = [];
let unmapped = 0;
for (const f of raw.features) {
  const bucket = SOURCE_VALUE_TO_KEY[f.properties.Liq_Cat];
  if (!bucket) { unmapped++; continue; }
  features.push({
    type: 'Feature',
    geometry: { type: f.geometry.type, coordinates: roundCoords(f.geometry.coordinates) },
    properties: {
      liq_bucket: bucket,
      liq_cat_raw: f.properties.Liq_Cat,
      detail: f.properties.Detail || null,
      study_date: f.properties.Study_Date || null,
    },
  });
}

const geojson = { type: 'FeatureCollection', features };
writeFileSync(OUT_PATH, JSON.stringify(geojson));

const byBucket = Object.fromEntries(Object.values(SOURCE_VALUE_TO_KEY).map((k) => [k, 0]));
for (const f of features) byBucket[f.properties.liq_bucket]++;
console.log(`Wrote ${features.length} features to ${OUT_PATH}`);
console.log('  by bucket:', byBucket);
if (unmapped) console.log(`  WARNING: ${unmapped} features had an unrecognised Liq_Cat value and were skipped`);
