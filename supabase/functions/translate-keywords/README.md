# translate-keywords Edge Function

Translates the canonical English scraper-keyword list into an event's
language(s) via Gemini, for the admin UI's "Auto-translate with AI" button.

## Deploy

```
supabase functions deploy translate-keywords --project-ref <your-lfe-project-ref>
supabase secrets set LLM_API_KEY=<your-gemini-api-key> --project-ref <your-lfe-project-ref>
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
provided automatically by the Edge Functions runtime - only `LLM_API_KEY`
needs to be set by hand.

## Request

Two modes, depending on whether the event already exists:

```
// Existing event (Manage events -> Keywords)
{ "event_id": "<uuid>", "languages": ["ja"], "terms": ["earthquake", "damage", ...] }

// Not created yet (Create event form) - name/country passed directly since
// there is no events row to read them from
{ "languages": ["ja"], "event_name": "...", "country": "...", "terms": [...] }
```

`languages` should be the *foreign* (non-English) languages to generate -
the admin's own English list (`terms`) is the source text, not a translation
target. `terms` is optional; falls back to a small built-in canonical
earthquake/damage term list if omitted.

```
POST /functions/v1/translate-keywords
Authorization: Bearer <the calling user's session JWT>
Content-Type: application/json
```

If `event_id` is given, the caller must be a platform_admin or hold the
`admin` role in `event_members` for that specific event. If `event_id` is
omitted (translating before the event exists), only a platform_admin may
call it - there is no event yet to hold a lesser "admin of this event" role
against. Both checked server-side with the service-role key, not just by
the presence of a header.

## Response

```
{ "keywordSets": { "en": ["earthquake", ...], "ja": ["...", ...] } }
```
