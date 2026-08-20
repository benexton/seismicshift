// Returns every leaderboard entry, including email, gated by a shared
// password - a single-owner prize draw, not a system with real accounts to
// manage, so a shared password checked server-side (never shipped in the
// client bundle) is the right amount of protection here. The caller still
// needs a valid anonymous-auth JWT to get past the API gateway, but that
// identity is never itself the check - admin_password is.
//
// Deploy: supabase functions deploy build-to-thrive-admin-list --project-ref qrblhtyoslxvoyyafgkl
// Secret: supabase secrets set ADMIN_PASSWORD=... --project-ref qrblhtyoslxvoyyafgkl
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.0';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_PASSWORD = Deno.env.get('ADMIN_PASSWORD');

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  if (!ADMIN_PASSWORD || payload.admin_password !== ADMIN_PASSWORD) {
    return json(401, { error: 'Wrong password' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json(401, { error: 'Missing Authorization header' });

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json(401, { error: 'Not signed in' });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data, error } = await admin
    .from('build_to_thrive_scores')
    .select('id, created_at, name, email, score, building_type, system_key, level_key')
    .order('score', { ascending: false });

  if (error) {
    console.error('build-to-thrive-admin-list: scores select failed', error);
    return json(500, { error: 'Could not load scores' });
  }
  return json(200, { scores: data });
});
