// Step 1 of the EPB register pipeline (see build_epb_geojson.mjs for step 2).
// Reads the two MBIE earthquake-prone building register exports in docs/,
// dedupes to one row per street address, and geocodes each via Nominatim
// (OpenStreetMap's free geocoder - no API key, but capped at 1 request/sec
// by its usage policy, so a full run against ~7,300 addresses takes a
// couple of hours). Resumable: results are cached to
// scripts/building-stock/epb-geocode-cache.json keyed by address, and
// re-running only geocodes addresses missing from that cache.
//
// House-number validation (2026-09-14, added after a real mismatch was
// spotted on the live map - "1 Lincoln Road" pinned to a "1/317 Lincoln
// Road" townhouse complex ~1.5km away): Nominatim will happily return a
// "best guess" node when the exact street number isn't in OSM at all (common
// for institutional/campus buildings), with no signal in the plain
// lat/lon response that it did so. Requesting addressdetails=1 exposes the
// address it actually matched, so the result's house_number can be checked
// against the number we asked for.
//
// Three things get tried, in order, before a result is accepted as
// `approximate: true` (2026-09-14, after the user asked to drive the
// approximate count down rather than just flag it):
//   1. Structured search (street + city), then free-text search (full
//      address incl. suburb) if that didn't match exactly.
//   2. Range tolerance: a returned house_number like "231-235" for a query
//      of "231" is treated as a real match, not approximate - Nominatim/OSM
//      genuinely addresses some properties as a number range, and the
//      queried number falling inside it is a different, safe case from the
//      Lincoln Road bug (a UNIT-style "1/317" is never range-tolerant - see
//      isRangeMatch's own comment for why the two must stay distinct).
//   3. Alternate address slots: ~120 rows in the source CSV list a second
//      (occasionally third+) distinct street address under the same notice
//      (e.g. "195 Jackson Street" and "197 Jackson Street" together) - if
//      the primary address doesn't get an exact/range match, an alternate's
//      *exact* geocode is a real, verified point for a building covered by
//      this same legal notice, and is preferred over a fuzzy guess at the
//      primary address itself.
// Only if none of that produces an exact/range/alternate match does the best
// available guess get kept with `approximate: true`.
//
// Usage: node scripts/building-stock/geocode_epb_addresses.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadCsv, buildUniqueAddresses } from './lib_epb_csv.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const ALL_CSV = join(ROOT, 'docs', 'ALL Buildings.csv');
const CACHE_PATH = join(__dirname, 'epb-geocode-cache.json');

const buildings = buildUniqueAddresses(loadCsv(ALL_CSV));

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
  if (!data || !data[0]) return null;
  return {
    lat: Number(data[0].lat), lon: Number(data[0].lon), display_name: data[0].display_name,
    house_number: data[0].address?.house_number ?? null,
  };
}

function geocodeStructured(addr) {
  return nominatimSearch(new URLSearchParams({
    format: 'jsonv2', countrycodes: 'nz', limit: '1', addressdetails: '1',
    street: addr.addressLine.split(',')[0], city: addr.city || addr.suburb || '', country: 'New Zealand',
  }));
}

function geocodeFreeText(addr) {
  // "217 to 223 Knights Road" -> "217 Knights Road" - Nominatim doesn't
  // understand street-number ranges, so query on just the first one.
  const cleanedLine = addr.addressLine.replace(/^(\d+)\s+to\s+\d+\s+/i, '$1 ');
  return nominatimSearch(new URLSearchParams({
    format: 'jsonv2', countrycodes: 'nz', limit: '1', addressdetails: '1', q: `${cleanedLine}, New Zealand`,
  }));
}

// A dash means OSM has this as a number range on one property ("231-235") -
// the queried number falling inside it is a real match. A slash means a
// unit/street-number pair ("1/317" = unit 1 of number 317) - never treated
// as a match here, since the actual street number there is 317, not 1; this
// is exactly the Lincoln Road case the whole approximate-flagging exists
// for, so the two formats must never be conflated.
function isRangeMatch(streetNumber, houseNumber) {
  const m = /^(\d+)\s*-\s*(\d+)$/.exec(houseNumber || '');
  const n = parseInt(streetNumber, 10);
  if (!m || Number.isNaN(n)) return false;
  const lo = Math.min(Number(m[1]), Number(m[2]));
  const hi = Math.max(Number(m[1]), Number(m[2]));
  return n >= lo && n <= hi;
}

function houseNumberMatches(addr, result) {
  if (!result?.house_number) return false;
  const hn = result.house_number.toLowerCase();
  return hn === addr.streetNumber || isRangeMatch(addr.streetNumber, hn);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Structured then free-text for one address candidate. Returns an exact/
// range match if either succeeds, else the better of the two unconfirmed
// results (free-text had suburb to work with, so it's preferred), else null.
async function geocodeCandidate(addr) {
  const structured = await geocodeStructured(addr);
  await sleep(1100);
  if (houseNumberMatches(addr, structured)) {
    return { lat: structured.lat, lon: structured.lon, display_name: structured.display_name, approximate: false };
  }
  const freeText = await geocodeFreeText(addr);
  await sleep(1100);
  if (houseNumberMatches(addr, freeText)) {
    return { lat: freeText.lat, lon: freeText.lon, display_name: freeText.display_name, approximate: false };
  }
  const best = freeText || structured;
  return best ? { lat: best.lat, lon: best.lon, display_name: best.display_name, approximate: true } : null;
}

async function geocodeOne(b) {
  const primaryResult = await geocodeCandidate(b);
  if (primaryResult && !primaryResult.approximate) return primaryResult;

  for (const alt of b.alternates) {
    const altResult = await geocodeCandidate(alt);
    if (altResult && !altResult.approximate) {
      // A confirmed point for a different address on the same notice beats
      // an unconfirmed guess at the requested one - still worth knowing it
      // came from a substitution, hence the note in display_name.
      return { ...altResult, display_name: `${altResult.display_name} (matched via alternate address on same notice: ${alt.addressLine})` };
    }
  }

  return primaryResult; // null, or the best unconfirmed guess - approximate: true either way
}

async function main() {
  const todo = buildings.filter((b) => !(b.addrKey in cache));
  console.log(`${new Date().toISOString()} Starting geocode: ${todo.length} remaining of ${buildings.length} total addresses`);
  let done = 0;
  let failed = 0;
  let approximate = 0;
  for (const b of todo) {
    let result = null;
    try {
      result = await geocodeOne(b);
    } catch (e) {
      console.error(`Error geocoding ${b.addrKey}: ${e.message}`);
      await sleep(2000);
    }
    cache[b.addrKey] = result;
    if (!result) failed++;
    else if (result.approximate) approximate++;
    done++;
    if (done % 25 === 0) {
      saveCache();
      console.log(`${new Date().toISOString()} progress: ${done}/${todo.length} (failed: ${failed}, approximate: ${approximate})`);
    }
  }
  saveCache();
  console.log(`${new Date().toISOString()} DONE. geocoded this run: ${done}, failed: ${failed}, approximate: ${approximate}`);
}

main().catch((e) => { console.error('FATAL', e); process.exitCode = 1; });
