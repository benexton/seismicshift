// LFE's own domain vocabulary. Forked from constants.js rather than sharing it
// because the observation-type list differs (multi-select, plus an
// emergency_management category Kumamoto's schema does not accept) - adding
// that here must never leak into Kumamoto's single-select UI over a DB column
// that only allows Kumamoto's original six values.
// No em dashes anywhere in generated output (site style: short dashes only).

// TEMPORARY: hides site/attachment photos from the public viewer only (map
// tooltip thumbnail, table thumbnail, and detail-modal images) - the
// internal triage queue and triaged-sites views are unaffected. Flip back to
// false to restore public images.
export const PUBLIC_IMAGES_HIDDEN = true;

export {
  GREAT_PERFORMANCE,
  DAMAGE_SCORES,
  CLASSIFICATION_SCORES,
  DAMAGE_LABEL,
  DAMAGE_COLOR,
  isDamageScore,
  CODE_ERAS,
  RETROFIT_OPTIONS,
  PRECISION_OPTIONS,
  LOCATION_CONFIDENCE,
  BUILDING_TYPES,
  PRIMARY_MATERIALS,
  HEIGHT_CLASSES,
  cap,
  fmtDate,
} from './constants.js';

// ---- Provenance / source type (adds 'twitter', which Kumamoto's schema does
// not accept - forked for the same reason observation types are, above) -----
export const SOURCE_TYPES = ['human', 'bluesky', 'twitter', 'rss', 'other'];

export const SOURCE_LABEL = {
  human: 'Manual entry',
  bluesky: 'Bluesky',
  twitter: 'X / Twitter',
  rss: 'News / RSS',
  other: 'Other',
};

// Border colour used to ring each map dot by provenance.
export const SOURCE_COLOR = {
  human: '#ffffff',
  bluesky: '#1185fe',
  twitter: '#111111',
  rss: '#f59e0b',
  other: '#9e9e9e',
};

// Human-readable provenance including who entered a manual observation, e.g.
// "Manual entry by Jane Smith", or just "Bluesky" / "X / Twitter" for scraped.
export function provenanceLabel(rec) {
  const base = SOURCE_LABEL[rec?.source_type] ?? 'Other';
  return rec?.source_type === 'human' && rec?.submitted_by ? `${base} by ${rec.submitted_by}` : base;
}

// ---- Observation type (multi-select) ---------------------------------------
export const OBSERVATION_TYPES = [
  'building',
  'geotechnical',
  'landslide',
  'lifeline',
  'emergency_management',
  'tsunami',
  'other',
];

export const OBSERVATION_LABEL = {
  building: 'Building',
  geotechnical: 'Geotechnical / ground failure',
  landslide: 'Landslide / slope failure',
  lifeline: 'Lifeline / infrastructure',
  emergency_management: 'Emergency management / response',
  tsunami: 'Tsunami',
  other: 'Other',
};

// Join labels for an observation_types array for display, e.g. in map
// tooltips, table cells, and report tables.
export function observationTypesLabel(types) {
  if (!types || !types.length) return '-';
  return types.map((t) => OBSERVATION_LABEL[t] ?? t).join(' + ');
}

// A bare '-' for a missing report field reads as "confirmed: none" rather
// than "still needs entering" - used in both the on-screen report preview
// and the downloaded .docx so a reviewer can't mistake one for the other.
export function phOr(value) {
  return (value === null || value === undefined || value === '') ? '[add before publishing]' : value;
}

// Built-in basemap presets an admin can pick from when creating an event,
// and the ones the public views themselves can fall back to. Shared here
// (rather than duplicated per-file) since PublicViewLfe's combined "all
// events" map needs a sensible default with true global coverage -
// gsi_photo (Japan-only aerial imagery from GSI) would render blank
// outside Japan, so esri_world_imagery is the one used there.
export const BASEMAP_PRESETS = {
  gsi_photo: {
    label: 'GSI Aerial (Japan)',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
    attribution: '&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">GSI Japan</a>',
  },
  osm: {
    label: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  esri_world_imagery: {
    label: 'Esri World Imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri, Maxar, Earthstar Geographics',
  },
};

// Small, type-specific structured fields shown when that type is ticked,
// stored in triage_records.type_details (jsonb, keyed by type). 'building'
// has its own dedicated fields already (building_name/type/material/etc);
// 'other' has none - both are intentionally absent here. Each entry is
// [key, label, options] - options is an array for a <select>, or null for
// free text.
export const TYPE_DETAIL_FIELDS = {
  geotechnical: [
    ['failure_type', 'Ground failure type', ['liquefaction', 'lateral spreading', 'settlement', 'ground cracking', 'other']],
    ['affected_feature', 'Affected feature', null],
  ],
  landslide: [
    ['slope_type', 'Slope type', ['cut slope', 'fill slope', 'natural slope']],
    ['trigger', 'Trigger', ['shaking', 'rainfall-saturated', 'undercutting', 'other']],
  ],
  lifeline: [
    ['lifeline_type', 'Lifeline type', ['water supply', 'wastewater', 'power', 'telecommunications', 'road', 'rail', 'bridge', 'port']],
    ['service_status', 'Service status', ['out of service', 'degraded', 'restored', 'unknown']],
  ],
  emergency_management: [
    ['activity_type', 'Activity type', ['evacuation centre', 'search and rescue', 'relief distribution', 'medical', 'other']],
    ['agency', 'Agency / organisation', null],
  ],
  tsunami: [
    ['inundation_extent', 'Inundation extent', ['minor', 'moderate', 'severe', 'unknown']],
    ['warning_status', 'Warning status', ['issued and heeded', 'issued not heeded', 'not issued', 'unknown']],
  ],
};
