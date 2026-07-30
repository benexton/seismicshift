import { createClient } from '@supabase/supabase-js';

// Injected at build time by Astro/Vite. MUST be PUBLIC_* to reach the client.
// The anon key is safe to ship: every table is guarded by Row Level Security,
// and the triage tables additionally require an authenticated session.
const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    '[vert] Missing PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env and fill them in.'
  );
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// Columns the client reads (never the raw PostGIS geom — we use the generated
// longitude/latitude columns instead).
export const RECORD_COLUMNS =
  'id, created_at, source_url, media_url, region, longitude, latitude, ' +
  'damage_score, code_era, failure_mechanism, observed_retrofits, ai_confidence, ' +
  'ai_model, status, engineer_notes, reviewed_by, reviewed_at';
