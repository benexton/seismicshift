// Shared domain constants for the triage UI and report generator.
// No em dashes anywhere in generated output (site style: short dashes only).

// ---- Damage / performance classification -----------------------------------
// 0-4 are the damage scale (none -> collapse). 5 is a separate, positive
// classification for structures or infrastructure that performed notably well
// (for example a base-isolated building that came through undamaged). It is not
// "worse than collapse"; it is coloured distinctly and reported on its own.
export const GREAT_PERFORMANCE = 5;

export const DAMAGE_SCORES = [0, 1, 2, 3, 4];

// Full list for dropdowns and the map legend (damage plus great performance).
export const CLASSIFICATION_SCORES = [0, 1, 2, 3, 4, GREAT_PERFORMANCE];

export const DAMAGE_LABEL = {
  0: 'D0 - None / negligible',
  1: 'D1 - Slight',
  2: 'D2 - Moderate',
  3: 'D3 - Heavy',
  4: 'D4 - Collapse / destruction',
  5: 'GP - Great performance',
};

export const DAMAGE_COLOR = {
  0: '#2e7d32',
  1: '#9acd32',
  2: '#f9a825',
  3: '#e53935',
  4: '#7b1414',
  5: '#2563eb',
};

// True for a real damage score (0-4), false for the great-performance marker.
export const isDamageScore = (s) => s >= 0 && s <= 4;

// ---- Seismic-code era ------------------------------------------------------
export const CODE_ERAS = ['pre-1981', '1981-2000', 'post-2000', 'unknown'];

// ---- Retrofits -------------------------------------------------------------
export const RETROFIT_OPTIONS = [
  'none',
  'tension-only bracing',
  'supplementary friction dampers',
  'other (see notes)',
];

// ---- Provenance / source type ---------------------------------------------
export const SOURCE_TYPES = ['human', 'bluesky', 'rss', 'other'];

export const SOURCE_LABEL = {
  human: 'Manual entry',
  bluesky: 'Bluesky',
  rss: 'News / RSS',
  other: 'Other',
};

// Border colour used to ring each map dot by provenance.
export const SOURCE_COLOR = {
  human: '#ffffff',
  bluesky: '#1185fe',
  rss: '#f59e0b',
  other: '#9e9e9e',
};

// ---- Observation type (building vs ground vs lifelines, etc.) --------------
export const OBSERVATION_TYPES = [
  'building',
  'geotechnical',
  'landslide',
  'lifeline',
  'tsunami',
  'other',
];

export const OBSERVATION_LABEL = {
  building: 'Building',
  geotechnical: 'Geotechnical / ground failure',
  landslide: 'Landslide / slope failure',
  lifeline: 'Lifeline / infrastructure',
  tsunami: 'Tsunami',
  other: 'Other',
};

// ---- Location precision ----------------------------------------------------
export const PRECISION_OPTIONS = ['exact', 'approximate'];
