import { createClient } from '@supabase/supabase-js';

// Injected at build time by Astro/Vite. MUST be PUBLIC_* to reach the client.
// This is a separate Supabase project from the Kumamoto one in supabase.js -
// the LFE platform never reads or writes the Kumamoto database.
const url = import.meta.env.PUBLIC_LFE_SUPABASE_URL;
const anonKey = import.meta.env.PUBLIC_LFE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    '[lfe] Missing PUBLIC_LFE_SUPABASE_URL / PUBLIC_LFE_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env.local and fill them in.'
  );
}

// createClient throws synchronously on an empty URL/key (rather than failing
// only when a call is made), which would crash the whole island before React
// even mounts. Fall back to a placeholder so the UI still renders pre-launch;
// auth/data calls will simply fail until the real project is configured.
export const supabaseLfe = createClient(url || 'https://lfe-not-configured.invalid', anonKey || 'not-configured', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// Storage bucket for observation photos/files across all LFE events.
export const LFE_MEDIA_BUCKET = 'lfe-observation-media';

// Columns the client reads (never the raw PostGIS geom; we read the generated
// longitude/latitude columns instead).
export const LFE_RECORD_COLUMNS =
  'id, event_id, site_id, created_at, source_url, media_url, region, longitude, latitude, ' +
  'damage_score, code_era, failure_mechanism, observed_retrofits, ai_confidence, ' +
  'ai_model, status, engineer_notes, reviewed_by, reviewed_at, ' +
  'source_type, observation_types, location_precision, submitted_by, phash, merged_into, ' +
  'building_name, address, location_confidence, streetview_url, building_type, primary_material, height_class, ' +
  'nonstructural_damage, type_details';
