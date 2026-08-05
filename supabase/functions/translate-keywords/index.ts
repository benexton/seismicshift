// Supabase Edge Function: translates the canonical English scraper-keyword
// list into an event's language(s) via Gemini, for the admin UI's "Auto-
// translate with AI" button. Holds LLM_API_KEY as a function secret - this
// is the one thing this round needed a server-side component for, since
// nothing else in the Node/Astro side of this repo calls an LLM.
//
// No em dashes anywhere in generated output (site style: short dashes only).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CANONICAL_TERMS = [
  'earthquake', 'collapse', 'damage', 'liquefaction', 'landslide', 'crack',
  'fire', 'evacuation', 'building', 'bridge', 'road', 'injured', 'rescue',
  'shelter', 'aftershock', 'emergency response', 'evacuation centre',
];

async function translateTerms(apiKey: string, lang: string, baseTerms: string[], eventName?: string, country?: string): Promise<string[]> {
  if (lang === 'en') return baseTerms;

  const prompt =
    'Translate this list of earthquake/damage-related search terms into the ' +
    `language with ISO code "${lang}", for use as social-media search keywords ` +
    `following ${eventName ?? 'an earthquake'}${country ? ` in ${country}` : ''}. ` +
    'Return ONLY a JSON array of strings, same length and order as the input, ' +
    `no commentary, no markdown fences. Input: ${JSON.stringify(baseTerms)}`;

  const model = 'gemini-2.0-flash';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini request failed (status ${res.status})`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.filter((x: unknown) => typeof x === 'string') : baseTerms;
  } catch {
    return baseTerms;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 });
  }

  try {
    // event_id is optional - the admin UI also offers translation on the
    // create-event form, before the event (and its event_id) exists yet.
    // event_name/country are passed directly in that case, since there is no
    // events row to look them up from. terms is the admin's own English
    // keyword list (from the "Scraper keywords in English" box); falls back
    // to the built-in canonical list if not supplied.
    const { event_id, languages, event_name, country, terms } = await req.json();
    if (!Array.isArray(languages) || languages.length === 0) {
      return new Response(JSON.stringify({ error: 'languages[] is required' }), { status: 400 });
    }
    const baseTerms: string[] = Array.isArray(terms) && terms.length ? terms : CANONICAL_TERMS;

    // SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are
    // provided automatically to every deployed Edge Function - only
    // LLM_API_KEY needs to be set manually (see this folder's README).
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const apiKey = Deno.env.get('LLM_API_KEY') ?? '';
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'LLM_API_KEY is not configured on this function' }), { status: 500 });
    }

    // Client scoped to the caller's own JWT, to identify who is actually
    // calling - the anon key by itself is also a valid JWT, so checking
    // getUser() (not just "an Authorization header is present") is what
    // proves a real signed-in user.
    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 });
    }
    const uid = userData.user.id;

    // Separate service-role client for the privileged role check. When
    // event_id is given, scope to THIS specific event, not "admin of any
    // event" - the same over-broad-grant shape already avoided for the
    // profiles lookup. When there is no event yet (translating during
    // event creation), there is nothing to scope to, so only a
    // platform_admin - never merely "admin of some other event" - may call
    // this, which is the stricter check of the two, not a broadened one.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: pa } = await adminClient.from('platform_admins').select('user_id').eq('user_id', uid).maybeSingle();

    let authorized = !!pa;
    let eventName = event_name;
    let eventCountry = country;

    if (event_id) {
      if (!authorized) {
        const { data: em } = await adminClient.from('event_members')
          .select('role').eq('event_id', event_id).eq('user_id', uid).eq('role', 'admin').maybeSingle();
        authorized = !!em;
      }
      const { data: event } = await adminClient.from('events').select('name, country').eq('id', event_id).maybeSingle();
      eventName = event?.name ?? eventName;
      eventCountry = event?.country ?? eventCountry;
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: event_id ? 'Not an admin of this event' : 'Not a platform admin' }), { status: 403 });
    }

    const keywordSets: Record<string, string[]> = {};
    for (const lang of languages) {
      keywordSets[lang] = await translateTerms(apiKey, lang, baseTerms, eventName, eventCountry);
    }

    return new Response(JSON.stringify({ keywordSets }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (ex) {
    return new Response(JSON.stringify({ error: String((ex as Error)?.message ?? ex) }), { status: 500 });
  }
});
