// LFE's own domain vocabulary. Forked from constants.js rather than sharing it
// because the observation-type list differs (multi-select, plus an
// emergency_management category Kumamoto's schema does not accept) - adding
// that here must never leak into Kumamoto's single-select UI over a DB column
// that only allows Kumamoto's original six values.
// No em dashes anywhere in generated output (site style: short dashes only).

export {
  GREAT_PERFORMANCE,
  DAMAGE_SCORES,
  CLASSIFICATION_SCORES,
  DAMAGE_LABEL,
  DAMAGE_COLOR,
  isDamageScore,
  CODE_ERAS,
  RETROFIT_OPTIONS,
  SOURCE_TYPES,
  SOURCE_LABEL,
  SOURCE_COLOR,
  PRECISION_OPTIONS,
  LOCATION_CONFIDENCE,
  BUILDING_TYPES,
  PRIMARY_MATERIALS,
  HEIGHT_CLASSES,
  cap,
  provenanceLabel,
  fmtDate,
} from './constants.js';

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
