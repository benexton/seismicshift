// Shared domain constants for the triage UI and report generator.
// No em dashes anywhere in generated output (site style: short dashes only).

// ---- Damage ----------------------------------------------------------------
export const DAMAGE_SCORES = [0, 1, 2, 3, 4];

export const DAMAGE_LABEL = {
  0: 'D0 - None / negligible',
  1: 'D1 - Slight',
  2: 'D2 - Moderate',
  3: 'D3 - Heavy',
  4: 'D4 - Collapse / destruction',
};

export const DAMAGE_COLOR = {
  0: '#2e7d32',
  1: '#9acd32',
  2: '#f9a825',
  3: '#e53935',
  4: '#7b1414',
};

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
