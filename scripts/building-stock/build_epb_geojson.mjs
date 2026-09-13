// Step 2 of the EPB register pipeline - run after
// geocode_epb_addresses.mjs has produced epb-geocode-cache.json (or at any
// point after, to rebuild the served GeoJSON from the current CSVs + cache
// without re-geocoding). Diffs the two MBIE register exports in docs/:
// "ALL Buildings.csv" is every address that has ever had an EPB notice;
// "Unremediated.csv" is the subset still on the register today. An address
// present in the ALL export but absent from Unremediated has had its notice
// lifted - that's the whole remediated/unremediated split, there's no other
// signal for it in the source data.
//
// Usage: node scripts/building-stock/build_epb_geojson.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const ALL_CSV = join(ROOT, 'docs', 'ALL Buildings.csv');
const UNREM_CSV = join(ROOT, 'docs', 'Unremediated.csv');
const CACHE_PATH = join(__dirname, 'epb-geocode-cache.json');
const OUT_PATH = join(ROOT, 'public', 'data', 'epb-buildings.geojson');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function loadCsv(path) {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  const rows = parseCsv(text).filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
  const header = rows[0];
  return rows.slice(1).map((r) => {
    const obj = {};
    header.forEach((h, idx) => { obj[h] = (r[idx] ?? '').trim(); });
    return obj;
  });
}

function addrKey(r) {
  return [r['Street number '], r['Street alpha '], r['Street name '], r['Street type '], r['Street direction '], r['Suburb '], r['Town/City ']]
    .map((s) => (s ?? '').toLowerCase()).join('|');
}

function addressLine(r) {
  const streetBits = [r['Street number '], r['Street alpha '], r['Street name '], r['Street type '], r['Street direction ']]
    .filter(Boolean).join(' ');
  return [streetBits, r['Suburb '], r['Town/City ']].filter(Boolean).join(', ');
}

function commonNames(r) {
  const names = [];
  for (let i = 1; i <= 10; i++) {
    const v = r[i === 1 ? 'Common name 1' : `Common name ${i}`];
    if (v) names.push(v);
  }
  return [...new Set(names)];
}

// dd/mm/yyyy -> comparable number, so "latest notice wins" as the
// representative row when one address has been notified more than once.
function dateSort(s) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s || '');
  if (!m) return 0;
  return Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]);
}

const allRows = loadCsv(ALL_CSV);
const unremRows = loadCsv(UNREM_CSV);
if (!existsSync(CACHE_PATH)) {
  console.error(`No geocode cache at ${CACHE_PATH} - run geocode_epb_addresses.mjs first.`);
  process.exit(1);
}
const cache = JSON.parse(readFileSync(CACHE_PATH, 'utf8'));

const unremAddrKeys = new Set(unremRows.map(addrKey));

const byAddr = new Map();
for (const r of allRows) {
  const key = addrKey(r);
  if (!key.replace(/\|/g, '')) continue;
  const entry = byAddr.get(key) ?? { key, rows: [] };
  entry.rows.push(r);
  byAddr.set(key, entry);
}

const features = [];
let missingGeocode = 0;
for (const [key, { rows }] of byAddr) {
  const geo = cache[key];
  if (!geo) { missingGeocode++; continue; }
  rows.sort((a, b) => dateSort(b['Date of issue']) - dateSort(a['Date of issue']));
  const rep = rows[0];
  features.push({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [geo.lon, geo.lat] },
    properties: {
      address: addressLine(rep),
      suburb: rep['Suburb '] || null,
      city: rep['Town/City '] || null,
      common_names: commonNames(rep).join(', ') || null,
      notice_type: rep['Notice type'] || null,
      date_of_issue: rep['Date of issue'] || null,
      earthquake_rating: rep['Earthquake rating'] || null,
      seismic_work_deadline: rep['Seismic work deadline'] || null,
      priority_building: rep['Priority building'] === 'Yes',
      notice_issued_by: rep['Notice issued by'] || null,
      heritage_status: rep['Heritage status'] || null,
      area_of_seismic_risk: rep['Area of seismic risk'] || null,
      notice_count: rows.length,
      remediated: !unremAddrKeys.has(key),
    },
  });
}

const geojson = { type: 'FeatureCollection', features };
writeFileSync(OUT_PATH, JSON.stringify(geojson));

const remediatedCount = features.filter((f) => f.properties.remediated).length;
console.log(`Wrote ${features.length} features to ${OUT_PATH}`);
console.log(`  remediated: ${remediatedCount}, unremediated: ${features.length - remediatedCount}`);
console.log(`  skipped (no geocode result yet): ${missingGeocode} of ${byAddr.size} unique addresses`);
