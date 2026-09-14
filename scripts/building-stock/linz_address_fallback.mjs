// Step 1b of the EPB register pipeline - a follow-up pass over whatever
// geocode_epb_addresses.mjs (Nominatim/OSM) left as `approximate: true` or
// failed entirely, re-queried against LINZ's own "NZ Addresses" dataset
// (layer 123113 on the LINZ Data Service, requires LINZ_API_KEY - a free
// key from data.linz.govt.nz -> Dashboard -> API and Web Services). LINZ is
// the authoritative source TAs report addresses to (not community-mapped
// like OSM), so it has exact points for institutional/campus addresses OSM
// never got individually mapped - e.g. "2 Fitzgerald Avenue, Christchurch"
// resolved here on the first try after Nominatim could only guess at a
// nearby unit-numbered property.
//
// Query strategy, per building (2026-09-14, tuned against real mismatches):
//   - Filter on address_number [+ address_number_suffix] + road_name +
//     road_name_type + town_city - deliberately NOT suburb_locality. A real
//     case ("1 Lincoln Road") had the source CSV's suburb ("Addington")
//     disagree with LINZ's own suburb_locality for that road ("Hillmorton") -
//     since LINZ's boundaries are the authoritative ones we're trusting here
//     anyway, requiring the source's suburb to also match would have thrown
//     away a correct result.
//   - A single street number in one town/city can return several LINZ
//     features (a subdivided property has one row per unit, e.g. "2/1",
//     "3/1" alongside plain "1"). Prefer the one whose `unit` field matches
//     what the source CSV says (null on both sides = a plain, unsubdivided
//     address - the common case). Only accept the match if it's unique.
//   - If a unit-based filter still leaves more than one candidate, use the
//     source's suburb as a tiebreaker (LINZ's suburb_locality, not required
//     but useful once there's real ambiguity to resolve).
//   - Anything still ambiguous, or with zero results, is left as whatever
//     the Nominatim pass already produced - this script only improves
//     entries, never discards a working result to replace it with nothing.
//
// Usage: node scripts/building-stock/linz_address_fallback.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadCsv, buildUniqueAddresses } from './lib_epb_csv.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const ALL_CSV = join(ROOT, 'docs', 'ALL Buildings.csv');
const CACHE_PATH = join(__dirname, 'epb-geocode-cache.json');

const LINZ_API_KEY = process.env.LINZ_API_KEY
  || (readFileSync(join(ROOT, '.env.local'), 'utf8').match(/^LINZ_API_KEY="?([^"\n]+)"?/m) || [])[1];
if (!LINZ_API_KEY) {
  console.error('No LINZ_API_KEY found in the environment or .env.local');
  process.exit(1);
}
const WFS_URL = `https://data.linz.govt.nz/services;key=${LINZ_API_KEY}/wfs`;

function cqlEscape(s) { return String(s).replace(/'/g, "''"); }

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function linzQuery(addr) {
  // A blank/non-numeric street number (whole-of-road or informal rural
  // entries in the source CSV) has nothing for LINZ's number-indexed
  // address dataset to match against - querying with address_number=NaN
  // isn't just unproductive, it's invalid CQL (a hard 400), so skip early.
  const number = parseInt(addr.streetNumberRaw, 10);
  if (Number.isNaN(number)) return [];

  const clauses = [
    `address_number=${number}`,
    `road_name='${cqlEscape(addr.streetName)}'`,
    `road_name_type='${cqlEscape(addr.streetType)}'`,
    `town_city='${cqlEscape(addr.city)}'`,
  ];
  if (addr.streetAlpha) clauses.push(`address_number_suffix='${cqlEscape(addr.streetAlpha)}'`);
  const cql = clauses.join(' AND ');

  const params = new URLSearchParams({
    service: 'WFS', version: '2.0.0', request: 'GetFeature',
    typeNames: 'layer-123113', outputFormat: 'json', cql_filter: cql,
  });
  const res = await fetch(`${WFS_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  // GeoJSON [lon, lat] - LINZ's declared CRS (EPSG:4167, NZGD2000) matches
  // WGS84 lon/lat ordering closely enough for map display (sub-metre
  // difference, irrelevant at this zoom level).
  return (data.features || []).map((f) => ({ ...f.properties, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }));
}

// null/'' on both sides counts as "no unit" - the common case for a plain
// street address.
function unitsMatch(sourceUnit, linzUnit) {
  return (sourceUnit || '').toLowerCase() === (linzUnit || '').toLowerCase();
}

function pickMatch(addr, candidates) {
  if (candidates.length === 1) return candidates[0];
  const byUnit = candidates.filter((c) => unitsMatch(addr.unit, c.unit));
  if (byUnit.length === 1) return byUnit[0];
  const pool = byUnit.length > 0 ? byUnit : candidates;
  if (addr.suburb) {
    const bySuburb = pool.filter((c) => (c.suburb_locality || '').toLowerCase() === addr.suburb.toLowerCase());
    if (bySuburb.length === 1) return bySuburb[0];
  }
  return null; // still ambiguous - don't guess
}

async function main() {
  const cache = JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
  const buildings = buildUniqueAddresses(loadCsv(ALL_CSV));
  const todo = buildings.filter((b) => {
    const entry = cache[b.addrKey];
    return b.addrKey in cache && (!entry || entry.approximate);
  });
  console.log(`${new Date().toISOString()} LINZ fallback: ${todo.length} approximate/failed addresses to retry`);

  let fixed = 0;
  let done = 0;
  for (const b of todo) {
    try {
      const candidates = await linzQuery(b);
      const match = pickMatch(b, candidates);
      if (match) {
        cache[b.addrKey] = { lat: match.lat, lon: match.lon, display_name: match.full_address, approximate: false, source: 'linz' };
        fixed++;
      }
    } catch (e) {
      console.error(`Error querying LINZ for ${b.addrKey}: ${e.message}`);
    }
    done++;
    if (done % 100 === 0) {
      writeFileSync(CACHE_PATH, JSON.stringify(cache));
      console.log(`${new Date().toISOString()} progress: ${done}/${todo.length} (fixed: ${fixed})`);
    }
    await sleep(120);
  }
  writeFileSync(CACHE_PATH, JSON.stringify(cache));
  console.log(`${new Date().toISOString()} DONE. checked: ${done}, fixed: ${fixed}`);
}

main().catch((e) => { console.error('FATAL', e); process.exitCode = 1; });
