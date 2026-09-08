// Config + shared logic for the "Building Stock Age" ERP tab. Adding a
// country later is a config change here (a new COUNTRIES entry with a real
// tilesetUrl) - never a UI refactor. tilesetUrl is null until the LINZ ->
// tippecanoe -> PMTiles pipeline (scripts/lfe/... in seismicshift-pipeline,
// not yet built as of 2026-09-08) has produced and uploaded a real archive;
// BuildingStockMapLfe shows a clear pending state rather than a broken map
// for any country whose tilesetUrl is still null.
export const COUNTRIES = [
  { code: 'NZ', label: 'New Zealand', tilesetUrl: null },
];

// Fixed decade -> era mapping, per the LINZ "NZ Properties: National
// District Valuation Roll" building-age coding and NZ's own seismic-code
// history - NOT derived from country_code_entries, since DVR's decade
// banding is a property of that specific data source, not a general rule.
// A decade straddling a code-boundary year rounds DOWN to the earlier era
// (conservative for seismic risk) - e.g. NZS 4203:1976 governs from 1976,
// but the 1970s decade band as a whole rounds down into 1965-1975.
//
// startYear is only set where it exactly matches a country_code_entries
// year_start for the country in question (NZ: 1935/1965/1976/1984/1992/
// 2004) - used to look up that entry's real title (e.g. "NZS 4203:1976")
// for the legend, rather than duplicating those strings here. Pre-1935 has
// no startYear: NZ had no seismic design provisions before NZSS 95 (1935),
// so there is no "governing standard" to show for that bucket - and
// "unknown" never has one either.
export const ERA_BUCKETS = [
  { key: 'pre-1935', label: 'Pre-1935', decades: ['pre-1930', '1930s'], startYear: null },
  { key: '1935-1964', label: '1935-1964', decades: ['1940s', '1950s', '1960s'], startYear: 1935 },
  { key: '1965-1975', label: '1965-1975', decades: ['1970s'], startYear: 1965 },
  { key: '1976-1983', label: '1976-1983', decades: ['1980s'], startYear: 1976 },
  { key: '1984-1991', label: '1984-1991', decades: ['1990s'], startYear: 1984 },
  { key: '1992-2003', label: '1992-2003', decades: ['2000s'], startYear: 1992 },
  { key: '2004-plus', label: '2004+', decades: ['2010s', '2020s'], startYear: 2004 },
  { key: 'unknown', label: 'Unknown', decades: [], startYear: null },
];

// The two oldest real (non-"unknown") buckets - what the below-threshold
// choropleth's pct_two_oldest property is a proportion of.
export const OLDEST_BUCKET_KEYS = ['pre-1935', '1935-1964'];

// ColorBrewer "YlOrRd" 7-class sequential ramp (colourblind-safe), oldest
// bucket = most saturated/darkest (highest seismic-risk vintage), newest =
// lightest. "unknown" is a distinct neutral grey, deliberately outside the
// ramp so it never reads as "very new" or gets visually folded into
// Pre-1935's dark end.
export const BUCKET_COLOR = {
  'pre-1935': '#b10026',
  '1935-1964': '#e31a1c',
  '1965-1975': '#fc4e2a',
  '1976-1983': '#fd8d3c',
  '1984-1991': '#feb24c',
  '1992-2003': '#fed976',
  '2004-plus': '#ffffb2',
  unknown: '#9ca3af',
};

// Zoom level the map switches from the SA2/territorial-authority choropleth
// to individual titles at. A tunable constant, not a structural decision -
// 12 is roughly where individual property parcels become visually
// distinguishable on a standard web map.
export const TITLE_MIN_ZOOM = 12;

// DVR decade string -> era bucket key, built once from ERA_BUCKETS above
// rather than hand-duplicated as a second mapping.
export const DECADE_TO_BUCKET = Object.fromEntries(
  ERA_BUCKETS.flatMap((b) => b.decades.map((d) => [d, b.key])),
);
