// Config + shared logic for the "Building Stock Age" ERP tab. Adding a
// country later is a config change here (a new COUNTRIES entry with a real
// tilesetUrl) - never a UI refactor. tilesetUrl is null until the LINZ ->
// tippecanoe -> PMTiles pipeline (scripts/lfe/... in seismicshift-pipeline,
// not yet built as of 2026-09-08) has produced and uploaded a real archive;
// BuildingStockMapLfe shows a clear pending state rather than a broken map
// for any country whose tilesetUrl is still null.
// defaultView centers the map on wherever the tileset actually has data,
// not just the country's geographic centre - real coverage is currently
// partial (see BuildingStockMapLfe.jsx's MethodologyNote), heavily weighted
// to Christchurch, so opening on generic central-NZ would show an
// almost-empty map. Update this if/when coverage broadens.
export const COUNTRIES = [
  { code: 'NZ', label: 'New Zealand', tilesetUrl: null, defaultView: { center: [172.64, -43.53], zoom: 11 } },
];

// How the not-yet-built ETL must decode LINZ's raw building_age_indicator
// code into a decade-start year (verified 2026-09-08 against the real DVR
// CSV's actual code distribution, not guessed):
//   - A plain 3-digit code IS the decade's first 3 digits - e.g. "196" is
//     the 1960s (decadeStartYear = Number(code) * 10), "202" is the 2020s.
//     Real range observed: '188' (1880s) through '202' (2020s).
//   - 'MIX' means the property has gone through multiple building ages
//     (e.g. a renovation/rebuild) and genuinely has no single decade -
//     mapped to the 'mixed' bucket below, kept visually distinct from
//     'unknown' rather than merged into it.
//   - '' (blank) means no age recorded at all.
//   - 'B18' / 'B19' appear in the real data but aren't in the RVR 2008
//     Table 8 documentation available to us, and LINZ's own NZ Properties
//     Data Dictionary only describes that lookup table's column *schema*,
//     not its actual code values - so their real meaning is unconfirmed.
//     Per explicit user decision (2026-09-08): converted to null, same as
//     blank, rather than guessed into a decade bucket - "do not attempt to
//     recode them."
//   - Blank and null-converted B18/B19 all land in the 'unknown' bucket.

// Fixed decade -> era mapping, per NZ's own seismic-code history - NOT
// derived from country_code_entries, since DVR's decade banding is a
// property of that specific data source, not a general rule. A decade
// straddling a code-boundary year rounds DOWN to the earlier era
// (conservative for seismic risk) - e.g. NZS 4203:1976 governs from 1976,
// but the 1970s decade band as a whole rounds down into 1965-1975.
//
// Ordinal, oldest to newest - minYear is the decade-start year at which a
// real decade starts rounding into this bucket (a decade maps to the last
// bucket whose minYear it is >=). standardStartYear (when set) is the
// matching country_code_entries.year_start for this bucket's governing
// standard - looked up from that table at render time rather than
// duplicating its title strings here. Pre-1935 predates any NZ seismic
// design provisions, so it has no standard to look up.
export const ERA_BUCKETS = [
  { key: 'pre-1935', label: 'Pre-1935', minYear: -Infinity, standardStartYear: null },
  { key: '1935-1964', label: '1935-1964', minYear: 1935, standardStartYear: 1935 },
  { key: '1965-1975', label: '1965-1975', minYear: 1965, standardStartYear: 1965 },
  { key: '1976-1983', label: '1976-1983', minYear: 1976, standardStartYear: 1976 },
  { key: '1984-1991', label: '1984-1991', minYear: 1984, standardStartYear: 1984 },
  { key: '1992-2003', label: '1992-2003', minYear: 1992, standardStartYear: 1992 },
  { key: '2004-plus', label: '2004+', minYear: 2004, standardStartYear: 2004 },
];

// Given a decade-start year (e.g. 1967 or 1970 both -> 1970), returns the
// ordinal era bucket it rounds down into. For the ETL script to mirror.
export function bucketKeyForDecadeStart(decadeStartYear) {
  let match = ERA_BUCKETS[0];
  for (const b of ERA_BUCKETS) {
    if (b.minYear <= decadeStartYear) match = b;
  }
  return match.key;
}

// Non-ordinal categories - not part of the age scale, so excluded from
// ERA_BUCKETS/the choropleth's pct_two_oldest calculation and given
// deliberately non-ramp colours (see BUCKET_COLOR) so neither reads as "an
// age" on the map.
export const SPECIAL_BUCKETS = [
  { key: 'mixed', label: 'Mixed / multiple ages' },
  { key: 'unknown', label: 'Unknown' },
];

// Every bucket the legend/map need to account for, ordinal ones first.
export const ALL_BUCKETS = [...ERA_BUCKETS, ...SPECIAL_BUCKETS];

// The two oldest ordinal buckets - what the below-threshold choropleth's
// pct_two_oldest property is a proportion of. 'mixed'/'unknown' records are
// excluded from that proportion's denominator entirely (the ETL's concern,
// documented here so the frontend and the eventual pipeline agree).
export const OLDEST_BUCKET_KEYS = ['pre-1935', '1935-1964'];

// ColorBrewer "YlOrRd" 7-class sequential ramp (colourblind-safe) for the
// ordinal buckets, oldest = most saturated/darkest (highest seismic-risk
// vintage), newest = lightest. 'unknown' and 'mixed' are each a distinct,
// deliberately non-ramp colour (grey vs. blue) - per 2026-09-08 decision,
// never merged with each other or folded into the ramp's dark/light ends.
export const BUCKET_COLOR = {
  'pre-1935': '#b10026',
  '1935-1964': '#e31a1c',
  '1965-1975': '#fc4e2a',
  '1976-1983': '#fd8d3c',
  '1984-1991': '#feb24c',
  '1992-2003': '#fed976',
  '2004-plus': '#ffffb2',
  mixed: '#60a5fa',
  unknown: '#9ca3af',
};

// Zoom level the map switches from the SA2/territorial-authority choropleth
// to individual titles at. A tunable constant, not a structural decision -
// 12 is roughly where individual property parcels become visually
// distinguishable on a standard web map.
export const TITLE_MIN_ZOOM = 12;
