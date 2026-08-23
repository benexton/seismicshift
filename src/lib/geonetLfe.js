// GeoNet counterpart to the USGS fetch in AdminAppLfe.jsx - source for New
// Zealand events. GeoNet's public quake API is much thinner than USGS's
// (no moment tensor, no ShakeMap-style hazard grids), so callers should
// expect this to leave more of the form unfilled than fetchUsgsEvent does,
// and offer a USGS backfill for the rest.

// GeoNet event URLs always end in the event id regardless of which tab is
// open (.../earthquake/2026p576643, .../earthquake/felt/2026p576643,
// .../earthquake/technical/2026p576643, ...) - unlike USGS, there is no tab
// segment *after* the id to strip out, so the last path segment is always it.
export function geonetIdFromInput(v) {
  const trimmed = (v || '').trim();
  if (!trimmed) return '';
  const parts = trimmed.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

// Mirrors fetchUsgsEvent()'s return shape so both providers can feed the same
// form setters in AdminAppLfe.jsx. GeoNet has no title/place string, no
// tsunami flag, and no moment tensor on this endpoint - those are left blank
// (tsunami for the manual dropdown, tensor for manual entry, same treatment
// as "faulting mechanism" gets for USGS today).
export async function fetchGeonetEvent(id) {
  const res = await fetch(`https://api.geonet.org.nz/quake/${id}`, {
    headers: { Accept: 'application/vnd.geo+json;version=2' },
  });
  if (!res.ok) throw new Error(`GeoNet lookup failed (status ${res.status})`);
  const data = await res.json();
  const p = data.features?.[0]?.properties ?? {};
  const coords = data.features?.[0]?.geometry?.coordinates ?? [];
  const mag = p.magnitude != null ? Number(p.magnitude) : null;
  return {
    name: mag != null && p.locality ? `M${mag.toFixed(1)} - ${p.locality}` : (p.locality || ''),
    magnitude: mag != null ? mag.toFixed(1) : '',
    depth: p.depth != null ? Number(p.depth).toFixed(1) : '',
    lng: coords[0] != null ? String(coords[0]) : '',
    lat: coords[1] != null ? String(coords[1]) : '',
    eventDatetime: p.time ? new Date(p.time).toISOString().slice(0, 16) : '',
    locationName: p.locality || '',
    maxMmi: p.mmi != null ? String(p.mmi) : '',
    tsunami: '',
    country: 'New Zealand',
    countryCode: 'NZ',
    languages: 'en',
  };
}
