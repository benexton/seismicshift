// Converts the three docs/Flood_Extent_*_(OpenData).geojson files (Christchurch
// City Council open-data exports of its Flood Hazard modelling - MIKE Powered
// by DHI hydraulic models per catchment) into the slim file the map actually
// serves. The raw exports are hydraulic-model mesh output: ~70-95MB each,
// 17 significant figures per coordinate and 100+ points per polygon, most of
// it far finer than a web map ever renders - this does two things about that:
//   1. Rounds coordinates to 6 decimal places (~11cm), same precision as
//      build_liquefaction_geojson.mjs.
//   2. Runs Ramer-Douglas-Peucker line simplification on every ring at a
//      ~3m tolerance (0.00003 degrees, chosen for Christchurch's latitude) -
//      visually indistinguishable from the source at any zoom this map
//      renders at, but cuts point count by ~85%. A ring that would simplify
//      below the 4 points a valid GeoJSON polygon ring needs keeps its
//      original points instead (only ever tiny slivers, so the cost of not
//      simplifying them is negligible).
// Each feature is tagged with a flood_year bucket key (see FLOOD_BUCKETS in
// src/lib/buildingStockAge.js) instead of keeping the source's free-text
// RainfallEvent - three separate source files rather than one column, so the
// mapping here is "which file", not a value lookup.
//
// The three docs/ source files are gitignored (70-94MB each, ~254MB total -
// too large for this public repo's history, unlike the small liquefaction/EPB
// sources) - re-download the "Flood Extent 10/50/200 Year" layers from
// Christchurch City Council's open-data portal (data-ccc.opendata.arcgis.com)
// to rebuild.
//
// Usage: node scripts/building-stock/build_flood_geojson.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const OUT_PATH = join(ROOT, 'public', 'data', 'flood-extent.geojson');

// Mirrors FLOOD_BUCKETS in src/lib/buildingStockAge.js.
const SOURCES = [
  { file: 'Flood_Extent_10_Year_(OpenData).geojson', key: '10yr' },
  { file: 'Flood_Extent_50_Year_(OpenData).geojson', key: '50yr' },
  { file: 'Flood_Extent_200_Year_(OpenData).geojson', key: '200yr' },
];

// ~3m at Christchurch's latitude (0.00003 degrees) - see header comment.
const SIMPLIFY_EPSILON_DEG = 0.00003;

function round6(n) { return Math.round(n * 1e6) / 1e6; }

// Perpendicular-distance-based RDP. `points` is an array of [x, y] pairs.
function rdp(points, epsilon) {
  if (points.length < 3) return points;
  let dmax = 0;
  let index = 0;
  const [x1, y1] = points[0];
  const [x2, y2] = points[points.length - 1];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const norm = Math.sqrt(dx * dx + dy * dy);
  for (let i = 1; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    // Endpoints coincide (closed ring's start == end) - the "line" is a
    // single point, so distance is plain Euclidean distance to it, not the
    // infinite-line cross-product formula below (which divides by zero norm
    // otherwise, or gives a bogus constant if guarded with a fallback norm).
    const d = norm === 0
      ? Math.hypot(x0 - x1, y0 - y1)
      : Math.abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / norm;
    if (d > dmax) { dmax = d; index = i; }
  }
  if (dmax > epsilon) {
    const left = rdp(points.slice(0, index + 1), epsilon);
    const right = rdp(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[points.length - 1]];
}

function simplifyRing(ring) {
  const simplified = rdp(ring, SIMPLIFY_EPSILON_DEG);
  // A valid GeoJSON polygon ring needs >= 4 positions (3 distinct + the
  // closing repeat). Simplification can occasionally collapse a tiny sliver
  // ring below that - fall back to the (rounded, unsimplified) original
  // rather than emit an invalid ring.
  const points = simplified.length >= 4 ? simplified : ring;
  return points.map((p) => p.map(round6));
}

function simplifyGeometry(geometry) {
  // Both source geometry types seen in practice (Polygon, MultiPolygon) are
  // arrays of polygons of rings of points - MultiPolygon just has one extra
  // level of nesting.
  const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
  const simplified = polygons.map((poly) => poly.map(simplifyRing));
  return {
    type: geometry.type,
    coordinates: geometry.type === 'MultiPolygon' ? simplified : simplified[0],
  };
}

const features = [];
for (const { file, key } of SOURCES) {
  const raw = JSON.parse(readFileSync(join(ROOT, 'docs', file), 'utf8'));
  for (const f of raw.features) {
    features.push({
      type: 'Feature',
      geometry: simplifyGeometry(f.geometry),
      properties: { flood_year: key, catchment: f.properties.Catchment ?? null },
    });
  }
  console.log(`  ${key}: ${raw.features.length} features from ${file}`);
}

const geojson = { type: 'FeatureCollection', features };
writeFileSync(OUT_PATH, JSON.stringify(geojson));

console.log(`Wrote ${features.length} features to ${OUT_PATH}`);
const byBucket = {};
for (const f of features) byBucket[f.properties.flood_year] = (byBucket[f.properties.flood_year] ?? 0) + 1;
console.log('  by bucket:', byBucket);
