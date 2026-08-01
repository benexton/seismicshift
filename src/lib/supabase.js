import { createClient } from '@supabase/supabase-js';

// Injected at build time by Astro/Vite. MUST be PUBLIC_* to reach the client.
// The anon key is safe to ship: RLS + an authenticated session guard all data.
const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    '[vert] Missing PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env.local and fill them in.'
  );
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// Storage bucket for manually-uploaded observation photos.
export const MEDIA_BUCKET = 'observation-media';

// Columns the client reads (never the raw PostGIS geom; we read the generated
// longitude/latitude columns instead).
export const RECORD_COLUMNS =
  'id, site_id, created_at, source_url, media_url, region, longitude, latitude, ' +
  'damage_score, code_era, failure_mechanism, observed_retrofits, ai_confidence, ' +
  'ai_model, status, engineer_notes, reviewed_by, reviewed_at, ' +
  'source_type, observation_type, location_precision, submitted_by, phash, merged_into, ' +
  'building_name, address, location_confidence, streetview_url, building_type, primary_material, height_class, ' +
  'nonstructural_damage';

// event_meta is a single row (id = 1). Map between snake_case columns and the
// camelCase keys the report template expects.
export const EVENT_META_ID = 1;

export const EVENT_META_MAP = [
  ['event_name', 'eventName', 'Event name'],
  ['version', 'version', 'Version'],
  ['magnitude', 'magnitude', 'Magnitude (Mw)'],
  ['depth', 'depth', 'Depth (km)'],
  ['location_name', 'locationName', 'Location (geographical)'],
  ['location_lat_long', 'locationLatLong', 'Location (lat/long)'],
  ['event_datetime', 'eventDatetime', 'Time and date'],
  ['faulting', 'faulting', 'Faulting mechanism'],
  ['max_mmi', 'maxMMI', 'Maximum MMI'],
  ['tsunami', 'tsunami', 'Tsunami alert'],
  ['contributors', 'contributors', 'Contributors'],
];

export function metaRowToCamel(row) {
  const out = {};
  for (const [col, key] of EVENT_META_MAP) out[key] = row?.[col] ?? '';
  return out;
}

export function camelToMetaRow(meta) {
  const out = { id: EVENT_META_ID };
  for (const [col, key] of EVENT_META_MAP) out[col] = meta?.[key] ?? '';
  return out;
}
