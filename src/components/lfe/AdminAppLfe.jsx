import { Fragment, useEffect, useState } from 'react';
import { supabaseLfe, edgeFunctionErrorMessage } from '../../lib/supabaseLfe.js';
import LoginGateLfe from './LoginGateLfe.jsx';
import LfeNavGroup from './LfeNavGroup.jsx';
import { BASEMAP_PRESETS } from '../../lib/constantsLfe.js';

// Accepts either a bare USGS event id (e.g. "us7000abcd") or a full event
// page URL and returns just the id. Event page URLs almost always carry a
// trailing tab segment (.../eventpage/us6000tgb9/executive, /moment-tensor,
// /shakemap, ...), so the id is whatever follows "eventpage", not simply the
// last path segment - otherwise a pasted URL resolves to the tab name instead
// of the actual id.
function usgsIdFromInput(v) {
  const trimmed = (v || '').trim();
  if (!trimmed) return '';
  const parts = trimmed.split('/').filter(Boolean);
  const epIdx = parts.findIndex((p) => p === 'eventpage');
  if (epIdx !== -1 && parts[epIdx + 1]) return parts[epIdx + 1];
  return parts[parts.length - 1];
}

// Bridges the two previously-disconnected keyword concepts: events.keyword_sets
// (what the admin UI collects/translates at create/edit time) and
// scraper_sources (what ingest_triage_data.py's load_sources() actually
// reads - kind='bluesky' rows, no per-language column of its own). Without
// this, keywords typed in during event creation just sat in keyword_sets
// doing nothing, and the scraper found zero sources for every new event.
// Additive only - never touches/removes existing scraper_sources rows, so it
// won't clobber a row an admin has since disabled or added by hand in the
// "Scraper keywords and feeds" tab.
async function syncKeywordsToScraperSources(eventId, keywordSets) {
  const terms = Object.values(keywordSets || {}).flat().map((t) => (t || '').trim()).filter(Boolean);
  if (!terms.length) return;

  const { data: existing } = await supabaseLfe.from('scraper_sources')
    .select('value').eq('event_id', eventId).eq('kind', 'bluesky');
  const known = new Set((existing ?? []).map((r) => r.value.trim().toLowerCase()));

  const toInsert = [];
  for (const term of terms) {
    const key = term.toLowerCase();
    if (known.has(key)) continue;
    known.add(key);
    toInsert.push(term);
  }
  if (!toInsert.length) return;

  const { data: u } = await supabaseLfe.auth.getUser();
  const createdBy = u?.user?.email ?? null;
  await supabaseLfe.from('scraper_sources').insert(
    toInsert.map((value) => ({ event_id: eventId, kind: 'bluesky', value, created_by: createdBy }))
  );
}

function slugify(name) {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `${base}-${new Date().getFullYear()}`;
}

// USGS place strings end in either a US state (e.g. "...17km NNE of Ridgecrest,
// CA") or a country/region ("...Catia La Mar, Venezuela") - checked in that
// order, since a handful of country names collide with US state names (e.g.
// "Georgia") and a US quake is far more common in this feed than one in the
// country of the same name.
const US_STATE_NAMES = new Set([
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut',
  'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa',
  'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan',
  'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada',
  'new hampshire', 'new jersey', 'new mexico', 'new york', 'north carolina',
  'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania', 'rhode island',
  'south carolina', 'south dakota', 'tennessee', 'texas', 'utah', 'vermont',
  'virginia', 'washington', 'west virginia', 'wisconsin', 'wyoming',
]);
const US_STATE_ABBR = new Set([
  'al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga', 'hi', 'id', 'il', 'in',
  'ia', 'ks', 'ky', 'la', 'me', 'md', 'ma', 'mi', 'mn', 'ms', 'mo', 'mt', 'ne', 'nv',
  'nh', 'nj', 'nm', 'ny', 'nc', 'nd', 'oh', 'ok', 'or', 'pa', 'ri', 'sc', 'sd', 'tn',
  'tx', 'ut', 'vt', 'va', 'wa', 'wv', 'wi', 'wy',
]);

// Country name (lowercase) -> ISO code and a sensible language list (local
// language(s) first, English last as the app's own working language - unless
// the country's primary language already is English). Covers the countries
// that actually show up in earthquake feeds regularly; anything not listed
// still gets its name captured, just with no code and English-only default.
const COUNTRY_INFO = {
  'japan': { code: 'JP', languages: ['ja', 'en'] },
  'indonesia': { code: 'ID', languages: ['id', 'en'] },
  'philippines': { code: 'PH', languages: ['en', 'tl'] },
  'mexico': { code: 'MX', languages: ['es', 'en'] },
  'chile': { code: 'CL', languages: ['es', 'en'] },
  'peru': { code: 'PE', languages: ['es', 'en'] },
  'ecuador': { code: 'EC', languages: ['es', 'en'] },
  'colombia': { code: 'CO', languages: ['es', 'en'] },
  'venezuela': { code: 'VE', languages: ['es', 'en'] },
  'guatemala': { code: 'GT', languages: ['es', 'en'] },
  'el salvador': { code: 'SV', languages: ['es', 'en'] },
  'costa rica': { code: 'CR', languages: ['es', 'en'] },
  'panama': { code: 'PA', languages: ['es', 'en'] },
  'argentina': { code: 'AR', languages: ['es', 'en'] },
  'bolivia': { code: 'BO', languages: ['es', 'en'] },
  'dominican republic': { code: 'DO', languages: ['es', 'en'] },
  'haiti': { code: 'HT', languages: ['fr', 'en'] },
  'jamaica': { code: 'JM', languages: ['en'] },
  'puerto rico': { code: 'PR', languages: ['es', 'en'] },
  'turkey': { code: 'TR', languages: ['tr', 'en'] },
  'greece': { code: 'GR', languages: ['el', 'en'] },
  'italy': { code: 'IT', languages: ['it', 'en'] },
  'iran': { code: 'IR', languages: ['fa', 'en'] },
  'afghanistan': { code: 'AF', languages: ['ps', 'fa', 'en'] },
  'pakistan': { code: 'PK', languages: ['ur', 'en'] },
  'india': { code: 'IN', languages: ['hi', 'en'] },
  'nepal': { code: 'NP', languages: ['ne', 'en'] },
  'china': { code: 'CN', languages: ['zh', 'en'] },
  'taiwan': { code: 'TW', languages: ['zh', 'en'] },
  'myanmar': { code: 'MM', languages: ['my', 'en'] },
  'vietnam': { code: 'VN', languages: ['vi', 'en'] },
  'thailand': { code: 'TH', languages: ['th', 'en'] },
  'papua new guinea': { code: 'PG', languages: ['en'] },
  'vanuatu': { code: 'VU', languages: ['en', 'fr'] },
  'solomon islands': { code: 'SB', languages: ['en'] },
  'fiji': { code: 'FJ', languages: ['en'] },
  'fiji islands': { code: 'FJ', languages: ['en'] },
  'tonga': { code: 'TO', languages: ['en', 'to'] },
  'new zealand': { code: 'NZ', languages: ['en'] },
  'australia': { code: 'AU', languages: ['en'] },
  'united states': { code: 'US', languages: ['en'] },
  'canada': { code: 'CA', languages: ['en', 'fr'] },
  'russia': { code: 'RU', languages: ['ru', 'en'] },
  'kazakhstan': { code: 'KZ', languages: ['kk', 'ru', 'en'] },
  'iceland': { code: 'IS', languages: ['is', 'en'] },
  'croatia': { code: 'HR', languages: ['hr', 'en'] },
  'albania': { code: 'AL', languages: ['sq', 'en'] },
  'morocco': { code: 'MA', languages: ['ar', 'fr', 'en'] },
  'algeria': { code: 'DZ', languages: ['ar', 'fr', 'en'] },
  'egypt': { code: 'EG', languages: ['ar', 'en'] },
  'south africa': { code: 'ZA', languages: ['en'] },
  'spain': { code: 'ES', languages: ['es', 'en'] },
  'portugal': { code: 'PT', languages: ['pt', 'en'] },
  'guam': { code: 'GU', languages: ['en'] },
  'american samoa': { code: 'AS', languages: ['en'] },
  'northern mariana islands': { code: 'MP', languages: ['en'] },
  'france': { code: 'FR', languages: ['fr', 'en'] },
};

// USGS "place" (or "title" as a fallback) is typically "{distance} {bearing}
// of {nearest place}, {region}" - the region we want is after the last comma.
// `title` also carries a leading "M {mag} - " that `place` normally doesn't.
function regionFromUsgsText(placeOrTitle) {
  if (!placeOrTitle) return null;
  const cleaned = placeOrTitle.replace(/^M\s*[\d.]+\s*-\s*/i, '');
  const lastComma = cleaned.lastIndexOf(',');
  if (lastComma === -1) return null;
  return cleaned.slice(lastComma + 1).trim();
}

// Returns {country, code, languages} for a parsed region string, checking
// US-state-ness first (see the comment above US_STATE_NAMES).
function countryInfoFromRegion(region) {
  if (!region) return null;
  const key = region.toLowerCase();
  if (US_STATE_NAMES.has(key) || US_STATE_ABBR.has(key)) {
    return { country: 'United States', code: 'US', languages: ['en'] };
  }
  const info = COUNTRY_INFO[key];
  if (info) return { country: region, code: info.code, languages: info.languages };
  return { country: region, code: '', languages: ['en'] };
}

function CreateEventPanel({ onCreated }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [country, setCountry] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [eventDatetime, setEventDatetime] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [magnitude, setMagnitude] = useState('');
  const [depth, setDepth] = useState('');
  const [languages, setLanguages] = useState('en');
  const [basemapKey, setBasemapKey] = useState('osm');
  const [zoom, setZoom] = useState(10);
  // The admin's own English source list, plus one editable, AI-generated
  // list per non-English language - keyed separately from englishKeywords
  // so "Generate foreign language scraper keywords" has a single clear
  // source to work from, rather than being one more entry in a per-language
  // loop.
  const [englishKeywords, setEnglishKeywords] = useState('');
  const [keywordText, setKeywordText] = useState({});
  const [usgsInput, setUsgsInput] = useState('');
  const [usgsBusy, setUsgsBusy] = useState(false);
  const [translateBusy, setTranslateBusy] = useState(false);
  const [confirmSkipTranslation, setConfirmSkipTranslation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  const langList = languages.split(',').map((l) => l.trim()).filter(Boolean);
  const foreignLangs = langList.filter((l) => l !== 'en');

  // Auto-suggests a slug from the name, but stops the moment the admin types
  // into the slug field directly - the admin has final say, not the name.
  useEffect(() => {
    if (!slugEdited) setSlug(name.trim() ? slugify(name) : '');
  }, [name, slugEdited]);

  function onLanguagesChange(v) {
    setLanguages(v);
    setConfirmSkipTranslation(false);
  }

  async function generateForeignKeywords() {
    setTranslateBusy(true); setStatus(null);
    try {
      const terms = englishKeywords.split(',').map((t) => t.trim()).filter(Boolean);
      const { data, error } = await supabaseLfe.functions.invoke('translate-keywords', {
        body: {
          languages: foreignLangs,
          event_name: name || undefined,
          country: country || undefined,
          terms: terms.length ? terms : undefined,
        },
      });
      if (error) throw new Error(await edgeFunctionErrorMessage(error));
      const sets = data?.keywordSets ?? {};
      setKeywordText((t) => {
        const next = { ...t };
        for (const l of foreignLangs) if (sets[l]) next[l] = sets[l].join(', ');
        return next;
      });
      setConfirmSkipTranslation(false);
      setStatus({ kind: 'ok', msg: 'Generated. Review the lists below before creating the event.' });
    } catch (ex) {
      setStatus({ kind: 'err', msg: `Generate failed: ${ex.message ?? ex}` });
    } finally {
      setTranslateBusy(false);
    }
  }

  async function fetchUsgs() {
    const id = usgsIdFromInput(usgsInput);
    if (!id) return setStatus({ kind: 'err', msg: 'Paste a USGS event id or event page URL first.' });
    setUsgsBusy(true); setStatus(null);
    try {
      const res = await fetch(`https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/${id}.geojson`);
      if (!res.ok) throw new Error(`USGS lookup failed (status ${res.status})`);
      const data = await res.json();
      const p = data.properties ?? {};
      const coords = data.geometry?.coordinates ?? [];
      if (p.title) setName(p.title);
      if (p.mag != null) setMagnitude(String(p.mag));
      if (coords[2] != null) setDepth(String(coords[2]));
      if (coords[0] != null) setLng(String(coords[0]));
      if (coords[1] != null) setLat(String(coords[1]));
      if (p.time) setEventDatetime(new Date(p.time).toISOString().slice(0, 16));

      const region = regionFromUsgsText(p.place || p.title);
      const info = countryInfoFromRegion(region);
      if (info) {
        setCountry(info.country);
        setCountryCode(info.code);
        onLanguagesChange(info.languages.join(', '));
      }

      setStatus({ kind: 'ok', msg: 'Fetched from USGS. Review the fields below before creating the event.' });
    } catch (ex) {
      setStatus({ kind: 'err', msg: `USGS lookup failed: ${ex.message ?? ex}` });
    } finally {
      setUsgsBusy(false);
    }
  }

  async function createEvent(e) {
    e.preventDefault();
    if (!name.trim()) return setStatus({ kind: 'err', msg: 'Event name is required.' });
    if (!slug.trim()) return setStatus({ kind: 'err', msg: 'Slug is required.' });

    const untranslated = foreignLangs.filter((l) => !(keywordText[l] || '').trim());
    if (untranslated.length && !confirmSkipTranslation) {
      setConfirmSkipTranslation(true);
      return setStatus({ kind: 'err', msg: `No keyword seeds yet for: ${untranslated.join(', ')}. Use "Generate foreign language scraper keywords" above, or click Create event again to continue without them.` });
    }

    setBusy(true); setStatus(null);
    try {
      const keywordSets = { en: englishKeywords.split(',').map((t) => t.trim()).filter(Boolean) };
      for (const l of foreignLangs) {
        keywordSets[l] = (keywordText[l] || '').split(',').map((t) => t.trim()).filter(Boolean);
      }
      const basemap = { [basemapKey]: BASEMAP_PRESETS[basemapKey] };
      const latNum = lat !== '' ? Number(lat) : null;
      const lngNum = lng !== '' ? Number(lng) : null;
      const { data: userData } = await supabaseLfe.auth.getUser();

      const { data: created, error } = await supabaseLfe.from('events').insert({
        slug: slug.trim(),
        name: name.trim(),
        country: country || null,
        country_code: countryCode || null,
        event_datetime: eventDatetime ? new Date(eventDatetime).toISOString() : null,
        epicentre_lat: latNum,
        epicentre_lng: lngNum,
        languages: langList.length ? langList : ['en'],
        basemap,
        map_center: { lat: latNum ?? 0, lng: lngNum ?? 0, zoom: Number(zoom) },
        keyword_sets: keywordSets,
        status: 'draft',
        is_public: false,
        created_by: userData?.user?.id ?? null,
      }).select().single();
      if (error) throw error;

      if (magnitude !== '' || depth !== '') {
        await supabaseLfe.from('event_meta').update({
          magnitude: magnitude !== '' ? Number(magnitude) : null,
          depth: depth !== '' ? Number(depth) : null,
        }).eq('event_id', created.id);
      }

      try {
        await syncKeywordsToScraperSources(created.id, keywordSets);
      } catch (syncEx) {
        console.warn('Failed to seed scraper sources from keywords:', syncEx);
      }

      setStatus({ kind: 'ok', msg: `Event "${created.name}" created (slug: ${created.slug}). It starts in draft - flip it to active on the Manage events tab once it's ready.` });
      setName(''); setSlug(''); setSlugEdited(false); setCountry(''); setCountryCode(''); setEventDatetime('');
      setLat(''); setLng(''); setMagnitude(''); setDepth(''); setUsgsInput('');
      setEnglishKeywords(''); setKeywordText({});
      setConfirmSkipTranslation(false);
      onCreated?.();
    } catch (ex) {
      setStatus({ kind: 'err', msg: `Create failed: ${ex.message ?? ex}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Create event</h2>

      <div className="field">
        <label>USGS event id or event page URL</label>
        <div className="link-add">
          <input type="text" value={usgsInput} onChange={(e) => setUsgsInput(e.target.value)}
            placeholder="e.g. us7000abcd, or a USGS event page URL" />
          <button type="button" className="mini" onClick={fetchUsgs} disabled={usgsBusy}>
            {usgsBusy ? 'Fetching...' : 'Fetch from USGS'}
          </button>
        </div>
        <span className="muted small">Optional. Auto-fills name, epicentre, time, magnitude, and depth below - review before saving.</span>
      </div>

      <form onSubmit={createEvent}>
        <div className="report-meta-form">
          <div><label>Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div>
            <label>Slug</label>
            <input type="text" value={slug} onChange={(e) => { setSlug(e.target.value); setSlugEdited(true); }}
              placeholder="e.g. catia-la-mar-2026" required />
            <span className="muted small">Used in the event's URL and public snapshot filename. Auto-suggested from the name, but you decide the final value.</span>
          </div>
          <div><label>Country</label><input type="text" value={country} onChange={(e) => setCountry(e.target.value)} /></div>
          <div><label>Country code</label><input type="text" value={countryCode} onChange={(e) => setCountryCode(e.target.value)} placeholder="e.g. NZ" /></div>
          <div><label>Event date/time</label><input type="datetime-local" value={eventDatetime} onChange={(e) => setEventDatetime(e.target.value)} /></div>
          <div><label>Epicentre latitude</label><input type="number" step="0.0001" value={lat} onChange={(e) => setLat(e.target.value)} /></div>
          <div><label>Epicentre longitude</label><input type="number" step="0.0001" value={lng} onChange={(e) => setLng(e.target.value)} /></div>
          <div><label>Magnitude (Mw)</label><input type="number" step="0.1" value={magnitude} onChange={(e) => setMagnitude(e.target.value)} /></div>
          <div><label>Depth (km)</label><input type="number" step="0.1" value={depth} onChange={(e) => setDepth(e.target.value)} /></div>
          <div><label>Languages (comma-separated codes)</label><input type="text" value={languages} onChange={(e) => onLanguagesChange(e.target.value)} placeholder="en, ja" /></div>
          <div>
            <label>Basemap preset</label>
            <select value={basemapKey} onChange={(e) => setBasemapKey(e.target.value)}>
              {Object.entries(BASEMAP_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div><label>Default zoom</label><input type="number" value={zoom} onChange={(e) => setZoom(e.target.value)} /></div>
        </div>

        <div className="field">
          <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Scraper keywords in English</label>
          <textarea value={englishKeywords} onChange={(e) => setEnglishKeywords(e.target.value)}
            placeholder="earthquake, collapse, damage, liquefaction, landslide, evacuation..." style={{ width: '100%' }} />
        </div>

        {foreignLangs.length > 0 && (
          <div className="field">
            <button type="button" className="btn secondary" onClick={generateForeignKeywords} disabled={translateBusy}>
              {translateBusy ? 'Generating...' : 'Generate foreign language scraper keywords'}
            </button>
            <span className="muted small" style={{ marginLeft: 8 }}>Requires the translate-keywords Edge Function to be deployed.</span>
          </div>
        )}

        {foreignLangs.map((l) => (
          <div className="field" key={l}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Keyword seeds ({l})</label>
            <textarea value={keywordText[l] || ''} onChange={(e) => setKeywordText((k) => ({ ...k, [l]: e.target.value }))}
              style={{ width: '100%' }} />
          </div>
        ))}

        <div className="report-actions">
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Creating...' : 'Create event'}</button>
          {status && <span className={`status-line ${status.kind}`}>{status.msg}</span>}
        </div>
      </form>
    </div>
  );
}

function EventKeywordsEditor({ event, onClose, onSaved }) {
  const languages = event.languages?.length ? event.languages : ['en'];
  const [text, setText] = useState(() => {
    const t = {};
    for (const l of languages) t[l] = (event.keyword_sets?.[l] ?? []).join(', ');
    return t;
  });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  async function translate() {
    setBusy(true); setStatus(null);
    try {
      const { data, error } = await supabaseLfe.functions.invoke('translate-keywords', {
        body: { event_id: event.id, languages },
      });
      if (error) throw new Error(await edgeFunctionErrorMessage(error));
      const sets = data?.keywordSets ?? {};
      setText((t) => {
        const next = { ...t };
        for (const l of languages) if (sets[l]) next[l] = sets[l].join(', ');
        return next;
      });
      setStatus({ kind: 'ok', msg: 'Translated. Review before saving.' });
    } catch (ex) {
      setStatus({ kind: 'err', msg: `Auto-translate failed: ${ex.message ?? ex}` });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true); setStatus(null);
    const keyword_sets = {};
    for (const l of languages) keyword_sets[l] = text[l].split(',').map((t) => t.trim()).filter(Boolean);
    const { error } = await supabaseLfe.from('events').update({ keyword_sets }).eq('id', event.id);
    if (error) { setBusy(false); return setStatus({ kind: 'err', msg: `Save failed: ${error.message}` }); }
    try {
      await syncKeywordsToScraperSources(event.id, keyword_sets);
    } catch (syncEx) {
      console.warn('Failed to seed scraper sources from keywords:', syncEx);
    }
    setBusy(false);
    onSaved?.();
    onClose?.();
  }

  return (
    <tr>
      <td colSpan={6}>
        <div className="card" style={{ margin: 0 }}>
          <div className="report-actions">
            <button type="button" className="mini" onClick={translate} disabled={busy}>
              {busy ? 'Working...' : 'Auto-translate with AI'}
            </button>
            <span className="muted small">Requires the translate-keywords Edge Function to be deployed.</span>
          </div>
          {languages.map((l) => (
            <div className="field" key={l}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Keyword seeds ({l})</label>
              <textarea value={text[l] ?? ''} onChange={(e) => setText((t) => ({ ...t, [l]: e.target.value }))} style={{ width: '100%' }} />
            </div>
          ))}
          <div className="report-actions">
            <button className="btn secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn" type="button" onClick={save} disabled={busy}>Save keyword sets</button>
            {status && <span className={`status-line ${status.kind}`}>{status.msg}</span>}
          </div>
        </div>
      </td>
    </tr>
  );
}

function EditEventPanel({ event, onClose, onSaved }) {
  const [name, setName] = useState(event.name || '');
  const [slug, setSlug] = useState(event.slug || '');
  const [country, setCountry] = useState(event.country || '');
  const [countryCode, setCountryCode] = useState(event.country_code || '');
  const [eventDatetime, setEventDatetime] = useState(event.event_datetime ? new Date(event.event_datetime).toISOString().slice(0, 16) : '');
  const [lat, setLat] = useState(event.epicentre_lat ?? '');
  const [lng, setLng] = useState(event.epicentre_lng ?? '');
  const [magnitude, setMagnitude] = useState('');
  const [depth, setDepth] = useState('');
  const [metaLoaded, setMetaLoaded] = useState(false);
  const [languages, setLanguages] = useState((event.languages?.length ? event.languages : ['en']).join(', '));
  const [basemapKey, setBasemapKey] = useState(Object.keys(event.basemap || {})[0] || 'osm');
  const [zoom, setZoom] = useState(event.map_center?.zoom ?? 10);
  const [gsheetId, setGsheetId] = useState(event.gsheet_id || '');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabaseLfe.from('event_meta').select('magnitude, depth').eq('event_id', event.id).maybeSingle();
      if (data) {
        setMagnitude(data.magnitude != null ? String(data.magnitude) : '');
        setDepth(data.depth != null ? String(data.depth) : '');
      }
      setMetaLoaded(true);
    })();
  }, [event.id]);

  async function save(e) {
    e.preventDefault();
    if (!name.trim()) return setStatus({ kind: 'err', msg: 'Event name is required.' });
    if (!slug.trim()) return setStatus({ kind: 'err', msg: 'Slug is required.' });
    setBusy(true); setStatus(null);
    try {
      const langList = languages.split(',').map((l) => l.trim()).filter(Boolean);
      const latNum = lat !== '' ? Number(lat) : null;
      const lngNum = lng !== '' ? Number(lng) : null;
      const basemap = { [basemapKey]: BASEMAP_PRESETS[basemapKey] };

      const { error } = await supabaseLfe.from('events').update({
        slug: slug.trim(),
        name: name.trim(),
        country: country || null,
        country_code: countryCode || null,
        event_datetime: eventDatetime ? new Date(eventDatetime).toISOString() : null,
        epicentre_lat: latNum,
        epicentre_lng: lngNum,
        languages: langList.length ? langList : ['en'],
        basemap,
        map_center: { lat: latNum ?? 0, lng: lngNum ?? 0, zoom: Number(zoom) },
        gsheet_id: gsheetId.trim() || null,
      }).eq('id', event.id);
      if (error) throw error;

      const { error: metaError } = await supabaseLfe.from('event_meta').update({
        magnitude: magnitude !== '' ? Number(magnitude) : null,
        depth: depth !== '' ? Number(depth) : null,
      }).eq('event_id', event.id);
      if (metaError) throw metaError;

      setStatus({ kind: 'ok', msg: 'Saved.' });
      onSaved?.();
    } catch (ex) {
      setStatus({ kind: 'err', msg: `Save failed: ${ex.message ?? ex}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td colSpan={6}>
        <div className="card" style={{ margin: 0 }}>
          <form onSubmit={save}>
            <div className="report-meta-form">
              <div><label>Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} required /></div>
              <div>
                <label>Slug</label>
                <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} required />
                <span className="muted small">Used in the event's URL and public snapshot filename. Changing it after the event has live data leaves a stale public snapshot until the next export runs.</span>
              </div>
              <div><label>Country</label><input type="text" value={country} onChange={(e) => setCountry(e.target.value)} /></div>
              <div><label>Country code</label><input type="text" value={countryCode} onChange={(e) => setCountryCode(e.target.value)} placeholder="e.g. NZ" /></div>
              <div><label>Event date/time</label><input type="datetime-local" value={eventDatetime} onChange={(e) => setEventDatetime(e.target.value)} /></div>
              <div><label>Epicentre latitude</label><input type="number" step="0.0001" value={lat} onChange={(e) => setLat(e.target.value)} /></div>
              <div><label>Epicentre longitude</label><input type="number" step="0.0001" value={lng} onChange={(e) => setLng(e.target.value)} /></div>
              <div><label>Magnitude (Mw)</label><input type="number" step="0.1" value={magnitude} onChange={(e) => setMagnitude(e.target.value)} disabled={!metaLoaded} /></div>
              <div><label>Depth (km)</label><input type="number" step="0.1" value={depth} onChange={(e) => setDepth(e.target.value)} disabled={!metaLoaded} /></div>
              <div><label>Languages (comma-separated codes)</label><input type="text" value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="en, ja" /></div>
              <div>
                <label>Basemap preset</label>
                <select value={basemapKey} onChange={(e) => setBasemapKey(e.target.value)}>
                  {Object.entries(BASEMAP_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div><label>Default zoom</label><input type="number" value={zoom} onChange={(e) => setZoom(e.target.value)} /></div>
            </div>
            <div className="field">
              <label>Google Sheet ID</label>
              <input type="text" value={gsheetId} onChange={(e) => setGsheetId(e.target.value)}
                placeholder="e.g. 1AbCDeFgHiJkL... (the id in the sheet's URL)" />
              <span className="muted small">
                Create a blank Google Sheet under your own account, share it with the service account's email
                (Editor access), then paste the sheet's id here. The export can only write to a sheet it's
                been given access to - it cannot create one itself.
              </span>
            </div>
            <div className="report-actions">
              <button className="btn secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button>
              <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save changes'}</button>
              {status && <span className={`status-line ${status.kind}`}>{status.msg}</span>}
            </div>
          </form>
        </div>
      </td>
    </tr>
  );
}

function ManageEventsPanel({ events, loading, onChanged }) {
  const [busyId, setBusyId] = useState(null);
  const [editingKeywords, setEditingKeywords] = useState(null);
  const [editingDetails, setEditingDetails] = useState(null);
  const [err, setErr] = useState('');

  async function updateEvent(ev, patch) {
    setBusyId(ev.id); setErr('');
    const { error } = await supabaseLfe.from('events').update(patch).eq('id', ev.id);
    setBusyId(null);
    if (error) return setErr(`Could not update "${ev.name}": ${error.message}`);
    onChanged?.();
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Manage events</h2>
      {err && <p className="status-line err">{err}</p>}
      {loading && <p className="muted">Loading...</p>}
      {!loading && events.length === 0 && <p className="muted">No events yet - create one on the other tab.</p>}
      {!loading && events.length > 0 && (
        <table className="record-table">
          <thead><tr><th>Name</th><th>Slug</th><th>Status</th><th>Public</th><th>Sheets backup</th><th></th></tr></thead>
          <tbody>
            {events.map((ev) => (
              <Fragment key={ev.id}>
                <tr>
                  <td>{ev.name}</td>
                  <td>{ev.slug}</td>
                  <td>
                    <select value={ev.status} disabled={busyId === ev.id}
                      onChange={(e) => updateEvent(ev, { status: e.target.value })}>
                      <option value="draft">draft</option>
                      <option value="active">active</option>
                      <option value="archived">archived</option>
                    </select>
                  </td>
                  <td>
                    <input type="checkbox" checked={ev.is_public} disabled={busyId === ev.id}
                      onChange={(e) => updateEvent(ev, { is_public: e.target.checked })} />
                  </td>
                  <td>
                    {ev.gsheet_id
                      ? <a href={`https://docs.google.com/spreadsheets/d/${ev.gsheet_id}`} target="_blank" rel="noreferrer">Open sheet</a>
                      : <span className="muted small">Not set - add the sheet ID via Edit</span>}
                  </td>
                  <td>
                    <button className="mini" onClick={() => { setEditingDetails(null); setEditingKeywords(editingKeywords === ev.id ? null : ev.id); }}>
                      Keywords
                    </button>{' '}
                    <button className="mini" onClick={() => { setEditingKeywords(null); setEditingDetails(editingDetails === ev.id ? null : ev.id); }}>
                      Edit
                    </button>
                  </td>
                </tr>
                {editingKeywords === ev.id && (
                  <EventKeywordsEditor event={ev} onClose={() => setEditingKeywords(null)} onSaved={onChanged} />
                )}
                {editingDetails === ev.id && (
                  <EditEventPanel event={ev} onClose={() => setEditingDetails(null)} onSaved={onChanged} />
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const PLATFORM_SCOPE = '__platform__';

function DisplayNameCell({ member, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(member.display_name ?? '');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabaseLfe.rpc('set_display_name', { p_user_id: member.user_id, p_display_name: draft });
    setBusy(false);
    if (!error) { setEditing(false); onSaved?.(); }
  }

  if (editing) {
    return (
      <span className="link-add">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. Jane Smith (NZSEE)"
          style={{ width: 160 }} autoFocus />
        <button className="mini" onClick={save} disabled={busy}>Save</button>
      </span>
    );
  }
  return (
    <span className="link-add">
      {member.display_name || <span className="muted small">(not set)</span>}
      <button className="mini" onClick={() => { setDraft(member.display_name ?? ''); setEditing(true); }}>Edit</button>
    </span>
  );
}

function ProvisionUsersPanel({ events }) {
  const [scope, setScope] = useState('');
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('triager');
  const [foundId, setFoundId] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [bulkEmails, setBulkEmails] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  const isPlatform = scope === PLATFORM_SCOPE;

  async function loadMembers(id) {
    if (!id) return setMembers([]);
    setLoadingMembers(true);
    const { data, error } = id === PLATFORM_SCOPE
      ? await supabaseLfe.rpc('list_platform_admins')
      : await supabaseLfe.rpc('list_event_members', { p_event_id: id });
    setLoadingMembers(false);
    if (error) return setErr(error.message);
    setMembers(data ?? []);
  }

  useEffect(() => { loadMembers(scope); }, [scope]); // eslint-disable-line react-hooks/exhaustive-deps

  async function lookup() {
    setErr(''); setFoundId(null);
    const v = email.trim();
    if (!v) return;
    const { data, error } = await supabaseLfe.rpc('lookup_user_by_email', { p_email: v });
    if (error) return setErr(error.message);
    if (!data) return setErr('No user found with that email. Create their account in the Supabase dashboard first.');
    setFoundId(data);
  }

  async function addMember() {
    if (!scope || !foundId) return;
    setBusy(true); setErr('');
    const { error } = isPlatform
      ? await supabaseLfe.rpc('grant_platform_admin', { p_user_id: foundId })
      : await supabaseLfe.from('event_members').upsert({ event_id: scope, user_id: foundId, role }, { onConflict: 'event_id,user_id' });
    setBusy(false);
    if (error) return setErr(error.message);
    setEmail(''); setFoundId(null);
    loadMembers(scope);
  }

  async function bulkAdd() {
    if (!scope || isPlatform) return;
    const list = [...new Set(bulkEmails.split(',').map((e) => e.trim()).filter(Boolean))];
    if (!list.length) return;
    setBulkBusy(true); setBulkResult(null); setErr('');
    const existingIds = new Set(members.map((m) => m.user_id));
    const added = []; const notFound = []; const alreadyMember = []; const failed = [];
    for (const emailAddr of list) {
      const { data: uid, error: lookupErr } = await supabaseLfe.rpc('lookup_user_by_email', { p_email: emailAddr });
      if (lookupErr) { failed.push(emailAddr); continue; }
      if (!uid) { notFound.push(emailAddr); continue; }
      if (existingIds.has(uid)) { alreadyMember.push(emailAddr); continue; }
      // Insert, not upsert: existingIds already excludes current members, so
      // there's no legitimate conflict left to resolve - an insert-only call
      // guarantees this can never silently downgrade an existing admin's role.
      const { error: insertErr } = await supabaseLfe.from('event_members')
        .insert({ event_id: scope, user_id: uid, role: 'triager' });
      if (insertErr) failed.push(emailAddr); else added.push(emailAddr);
    }
    setBulkBusy(false);
    setBulkResult({ added, notFound, alreadyMember, failed });
    setBulkEmails('');
    loadMembers(scope);
  }

  async function changeRole(userId, newRole) {
    setBusy(true); setErr('');
    const { error } = await supabaseLfe.from('event_members').update({ role: newRole }).eq('event_id', scope).eq('user_id', userId);
    setBusy(false);
    if (error) return setErr(error.message);
    loadMembers(scope);
  }

  async function removeMember(userId) {
    setBusy(true); setErr('');
    const { error } = isPlatform
      ? await supabaseLfe.rpc('revoke_platform_admin', { p_user_id: userId })
      : await supabaseLfe.from('event_members').delete().eq('event_id', scope).eq('user_id', userId);
    setBusy(false);
    if (error) return setErr(error.message);
    loadMembers(scope);
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Provision users</h2>
      <div className="field">
        <label>Event</label>
        <select value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="">Select an event...</option>
          <option value={PLATFORM_SCOPE}>— Platform admins (all events, global) —</option>
          {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name} ({ev.slug})</option>)}
        </select>
        {isPlatform && (
          <span className="muted small">
            Platform admins can create events and provision users on any event. This does not by itself grant
            access to any event's triage data - they still need their own membership on a given event to see its records.
          </span>
        )}
      </div>

      {scope && (
        <>
          <div className="field">
            <label>Add by email</label>
            <div className="link-add">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="volunteer@example.com" />
              <button type="button" className="mini" onClick={lookup}>Look up</button>
            </div>
          </div>
          {foundId && (
            <div className="field">
              {!isPlatform && (
                <>
                  <label>Role</label>
                  <div className="link-add">
                    <select value={role} onChange={(e) => setRole(e.target.value)}>
                      <option value="admin">Admin</option>
                      <option value="triager">Triager</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button className="btn" type="button" onClick={addMember} disabled={busy}>Add to event</button>
                  </div>
                </>
              )}
              {isPlatform && (
                <button className="btn" type="button" onClick={addMember} disabled={busy}>Grant platform admin</button>
              )}
            </div>
          )}

          {!isPlatform && (
            <div className="field">
              <label>Bulk add as triagers (comma-separated emails)</label>
              <div className="link-add">
                <input type="text" value={bulkEmails} onChange={(e) => setBulkEmails(e.target.value)}
                  placeholder="a@example.com, b@example.com, c@example.com" style={{ flex: 1 }} />
                <button type="button" className="mini" onClick={bulkAdd} disabled={bulkBusy || !bulkEmails.trim()}>
                  {bulkBusy ? 'Adding...' : 'Bulk add as triagers'}
                </button>
              </div>
              <span className="muted small">Everyone found is added with the Triager role. Existing members keep whatever role they already have.</span>
              {bulkResult && (
                <p className="status-line small" style={{ marginTop: 6 }}>
                  {bulkResult.added.length > 0 && <>Added as triager: {bulkResult.added.join(', ')}. </>}
                  {bulkResult.alreadyMember.length > 0 && <>Already a member, role unchanged: {bulkResult.alreadyMember.join(', ')}. </>}
                  {bulkResult.notFound.length > 0 && <>No account found (create in Supabase dashboard first): {bulkResult.notFound.join(', ')}. </>}
                  {bulkResult.failed.length > 0 && <>Failed: {bulkResult.failed.join(', ')}.</>}
                </p>
              )}
            </div>
          )}
          {err && <p className="status-line err">{err}</p>}

          <h3 style={{ fontSize: 14 }}>{isPlatform ? 'Current platform admins' : 'Current members'}</h3>
          {loadingMembers ? <p className="muted">Loading...</p> : (
            <table className="record-table">
              <thead><tr><th>Email</th><th>Display name</th>{!isPlatform && <th>Role</th>}<th></th></tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.user_id}>
                    <td>{m.email ?? m.user_id}</td>
                    <td><DisplayNameCell member={m} onSaved={() => loadMembers(scope)} /></td>
                    {!isPlatform && (
                      <td>
                        <select value={m.role} disabled={busy} onChange={(e) => changeRole(m.user_id, e.target.value)}>
                          <option value="admin">Admin</option>
                          <option value="triager">Triager</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      </td>
                    )}
                    <td><button className="mini danger" onClick={() => removeMember(m.user_id)} disabled={busy}>Remove</button></td>
                  </tr>
                ))}
                {members.length === 0 && <tr><td colSpan={isPlatform ? 3 : 4} className="muted">No {isPlatform ? 'platform admins' : 'members'} yet.</td></tr>}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

function AdminWorkspace({ signOut }) {
  const [isAdmin, setIsAdmin] = useState(null);
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [tab, setTab] = useState('create');

  async function checkAdmin() {
    const { data: userData } = await supabaseLfe.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return setIsAdmin(false);
    const [pa, em] = await Promise.all([
      supabaseLfe.from('platform_admins').select('user_id').eq('user_id', uid).maybeSingle(),
      supabaseLfe.from('event_members').select('event_id').eq('user_id', uid).eq('role', 'admin').limit(1),
    ]);
    setIsAdmin(!!pa.data || (em.data && em.data.length > 0));
  }

  async function loadEvents() {
    setLoadingEvents(true);
    const { data, error } = await supabaseLfe.from('events').select('*').order('created_at', { ascending: false });
    setLoadingEvents(false);
    if (!error) setEvents(data ?? []);
  }

  useEffect(() => { checkAdmin(); loadEvents(); }, []);

  if (isAdmin === null) return <div className="container">Checking access...</div>;

  if (!isAdmin) {
    return (
      <div className="container">
        <p className="err">You do not have LFE admin access. Contact an existing admin if you believe you need it.</p>
        <p><a href="/lfe/">Back to your events</a></p>
      </div>
    );
  }

  return (
    <div className="triage-shell">
      <div className="tabs">
        <LfeNavGroup />
        <span style={{ fontWeight: 600, alignSelf: 'center', margin: '0 6px' }}>LFE Admin</span>
        <button className={tab === 'create' ? 'active' : ''} onClick={() => setTab('create')}>Create event</button>
        <button className={tab === 'manage' ? 'active' : ''} onClick={() => setTab('manage')}>Manage events</button>
        <button className={tab === 'provision' ? 'active' : ''} onClick={() => setTab('provision')}>Provision users</button>
        <span className="tab-spacer" />
        <button className="signout" onClick={signOut}>Sign out</button>
      </div>
      <div className="tab-body">
        {tab === 'create' && <CreateEventPanel onCreated={loadEvents} />}
        {tab === 'manage' && <ManageEventsPanel events={events} loading={loadingEvents} onChanged={loadEvents} />}
        {tab === 'provision' && <ProvisionUsersPanel events={events} />}
      </div>
    </div>
  );
}

export default function AdminAppLfe() {
  return (
    <LoginGateLfe>
      {({ signOut }) => <AdminWorkspace signOut={signOut} />}
    </LoginGateLfe>
  );
}
