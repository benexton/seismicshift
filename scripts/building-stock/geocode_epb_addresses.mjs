// Step 1 of the EPB register pipeline (see build_epb_geojson.mjs for step 2).
// Reads the two MBIE earthquake-prone building register exports in docs/,
// dedupes to one row per street address, and geocodes each via Nominatim
// (OpenStreetMap's free geocoder - no API key, but capped at 1 request/sec
// by its usage policy, so a full run against ~7,300 addresses takes a
// couple of hours). Resumable: results are cached to
// scripts/building-stock/epb-geocode-cache.json keyed by address, and
// re-running only geocodes addresses missing from that cache (including
// ones that failed last time - see the README-less note below on retrying
// failures by deleting their cache entries first).
//
// Usage: node scripts/building-stock/geocode_epb_addresses.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const ALL_CSV = join(ROOT, 'docs', 'ALL Buildings.csv');
const UNREM_CSV = join(ROOT, 'docs', 'Unremediated.csv');
const CACHE_PATH = join(__dirname, 'epb-geocode-cache.json');

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

const allRows = loadCsv(ALL_CSV);
const uniqueAddrs = new Map();
for (const r of allRows) {
  const key = addrKey(r);
  if (!key.replace(/\|/g, '')) continue;
  if (!uniqueAddrs.has(key)) {
    uniqueAddrs.set(key, { addrKey: key, addressLine: addressLine(r), city: r['Town/City '] || null, suburb: r['Suburb '] || null });
  }
}
const buildings = [...uniqueAddrs.values()];

let cache = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, 'utf8')) : {};

const UA = 'seismicshift-erp-building-stock/1.0 (benexton@gmail.com, one-off EPB register geocode)';

function saveCache() {
  writeFileSync(CACHE_PATH, JSON.stringify(cache));
}

async function nominatimSearch(params) {
  const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data && data[0]
    ? { lat: Number(data[0].lat), lon: Number(data[0].lon), display_name: data[0].display_name }
    : null;
}

function geocodeOne(b) {
  return nominatimSearch(new URLSearchParams({
    format: 'jsonv2', countrycodes: 'nz', limit: '1',
    street: b.addressLine.split(',')[0], city: b.city || b.suburb || '', country: 'New Zealand',
  }));
}

function geocodeFallback(b) {
  // "217 to 223 Knights Road" -> "217 Knights Road" - Nominatim doesn't
  // understand street-number ranges, so retry free-text on just the first one.
  const cleanedLine = b.addressLine.replace(/^(\d+)\s+to\s+\d+\s+/i, '$1 ');
  return nominatimSearch(new URLSearchParams({
    format: 'jsonv2', countrycodes: 'nz', limit: '1', q: `${cleanedLine}, New Zealand`,
  }));
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  const todo = buildings.filter((b) => !(b.addrKey in cache));
  console.log(`${new Date().toISOString()} Starting geocode: ${todo.length} remaining of ${buildings.length} total addresses`);
  let done = 0;
  let failed = 0;
  for (const b of todo) {
    let result = null;
    try {
      result = await geocodeOne(b);
      await sleep(1100);
      if (!result) {
        result = await geocodeFallback(b);
        await sleep(1100);
      }
    } catch (e) {
      console.error(`Error geocoding ${b.addrKey}: ${e.message}`);
      await sleep(2000);
    }
    cache[b.addrKey] = result;
    if (!result) failed++;
    done++;
    if (done % 25 === 0) {
      saveCache();
      console.log(`${new Date().toISOString()} progress: ${done}/${todo.length} (failed so far: ${failed})`);
    }
  }
  saveCache();
  console.log(`${new Date().toISOString()} DONE. geocoded this run: ${done}, failed: ${failed}`);
}

main().catch((e) => { console.error('FATAL', e); process.exitCode = 1; });
