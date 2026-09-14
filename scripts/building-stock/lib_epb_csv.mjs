// Shared CSV parsing + address-candidate extraction for the EPB register
// pipeline (docs/ALL Buildings.csv), used by geocode_epb_addresses.mjs and
// linz_address_fallback.mjs. Both need the same "one building, several
// possible address slots" shape - see slotCandidate's comment.
import { readFileSync } from 'node:fs';

export function parseCsv(text) {
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

export function loadCsv(path) {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  const rows = parseCsv(text).filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
  const header = rows[0];
  return rows.slice(1).map((r) => {
    const obj = {};
    header.forEach((h, idx) => { obj[h] = (r[idx] ?? '').trim(); });
    return obj;
  });
}

function slotSuffix(n) { return n === 1 ? ' ' : ` ${n}`; }

// One candidate address from slot n of a row (1-21 in the source CSV - a
// single EPB notice can cover several street addresses), or null if that
// slot has no street name filled in.
export function slotCandidate(r, n) {
  const sfx = slotSuffix(n);
  const streetName = r[`Street name${sfx}`];
  if (!streetName) return null;
  const streetNumber = r[`Street number${sfx}`] || '';
  const streetAlpha = r[`Street alpha${sfx}`] || '';
  const streetType = r[`Street type${sfx}`] || '';
  const streetDirection = r[`Street direction${sfx}`] || '';
  const unit = r[`Unit${sfx}`] || '';
  const suburb = r[`Suburb${sfx}`] || '';
  const city = r[`Town/City${sfx}`] || '';
  const key = [streetNumber, streetAlpha, streetName, streetType, streetDirection, suburb, city]
    .map((s) => s.toLowerCase()).join('|');
  const streetBits = [streetNumber, streetAlpha, streetName, streetType, streetDirection].filter(Boolean).join(' ');
  return {
    key,
    addressLine: [streetBits, suburb, city].filter(Boolean).join(', '),
    unit: unit || null,
    city: city || null,
    suburb: suburb || null,
    streetName,
    streetType,
    // Street number + alpha only (no unit) - "217 to 223" ranges normalise
    // to their first number.
    streetNumber: `${streetNumber.replace(/^(\d+)\s+to\s+\d+$/i, '$1')}${streetAlpha}`.toLowerCase(),
    streetNumberRaw: streetNumber.replace(/^(\d+)\s+to\s+\d+$/i, '$1'),
    streetAlpha: streetAlpha || null,
  };
}

const MAX_ADDRESS_SLOTS = 21;

// One building per unique primary address, each carrying any distinct
// alternate addresses (slots 2-21) found on the same row.
export function buildUniqueAddresses(allRows) {
  const uniqueAddrs = new Map();
  for (const r of allRows) {
    const primary = slotCandidate(r, 1);
    if (!primary || !primary.key.replace(/\|/g, '')) continue;
    if (uniqueAddrs.has(primary.key)) continue;

    const alternates = [];
    const seen = new Set([primary.key]);
    for (let n = 2; n <= MAX_ADDRESS_SLOTS; n++) {
      const alt = slotCandidate(r, n);
      if (!alt || seen.has(alt.key)) continue;
      seen.add(alt.key);
      alternates.push(alt);
    }
    uniqueAddrs.set(primary.key, { addrKey: primary.key, ...primary, alternates });
  }
  return [...uniqueAddrs.values()];
}
