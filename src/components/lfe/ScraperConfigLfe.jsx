import { useEffect, useState } from 'react';
import { supabaseLfe } from '../../lib/supabaseLfe.js';
import { useEvent } from '../../lib/useEvent.js';

/**
 * Manage what the automated pipeline watches for this event. Rows written
 * here are read by scripts/lfe/ingest_triage_data.py on its next run, so
 * changing keywords or feeds needs no code edit.
 *
 * A search term can target Bluesky, X/Twitter, both, or neither - that's a
 * single scraper_sources row per platform sharing the same `value` text
 * (kind='bluesky' and/or kind='twitter'), grouped here by value and shown as
 * one row with a 4-state toggle rather than two separate lists. This keeps
 * AdminAppLfe.jsx's event-creation sync (which inserts kind='bluesky' rows
 * only) working unchanged - those terms just show up already set to
 * "Bluesky" and an admin can widen them to "Both" here.
 *
 * RSS feed URLs are a different kind of thing (not a cross-platform search
 * term) and stay their own simple enable/disable list.
 */
const TERM_STATES = [
  { value: 'inactive', label: 'Inactive' },
  { value: 'bluesky', label: 'Bluesky' },
  { value: 'twitter', label: 'X / Twitter' },
  { value: 'both', label: 'Both' },
];

function termState(term) {
  const b = term.bskyRow?.enabled ?? false;
  const t = term.twRow?.enabled ?? false;
  if (b && t) return 'both';
  if (b) return 'bluesky';
  if (t) return 'twitter';
  return 'inactive';
}

export default function ScraperConfigLfe() {
  const { event } = useEvent();
  const eventId = event?.id;
  const [rows, setRows] = useState([]);
  const [newTerm, setNewTerm] = useState('');
  const [newTermPlatform, setNewTermPlatform] = useState('bluesky');
  const [newFeed, setNewFeed] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  async function load() {
    if (!eventId) return;
    setLoading(true);
    const { data, error } = await supabaseLfe
      .from('scraper_sources')
      .select('id, kind, value, enabled, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });
    setLoading(false);
    if (error) return setErr(error.message);
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function currentUserEmail() {
    const { data: u } = await supabaseLfe.auth.getUser();
    return u?.user?.email ?? null;
  }

  async function addTerm(e) {
    e.preventDefault();
    const v = newTerm.trim();
    if (!v) return;
    setErr('');
    const createdBy = await currentUserEmail();
    const kinds = newTermPlatform === 'both' ? ['bluesky', 'twitter'] : [newTermPlatform];
    const { error } = await supabaseLfe
      .from('scraper_sources')
      .insert(kinds.map((kind) => ({ event_id: eventId, kind, value: v, created_by: createdBy })));
    if (error) return setErr(error.message);
    setNewTerm('');
    load();
  }

  async function addFeed(e) {
    e.preventDefault();
    const v = newFeed.trim();
    if (!v) return;
    setErr('');
    const createdBy = await currentUserEmail();
    const { error } = await supabaseLfe
      .from('scraper_sources')
      .insert({ event_id: eventId, kind: 'rss', value: v, created_by: createdBy });
    if (error) return setErr(error.message);
    setNewFeed('');
    load();
  }

  async function setTermPlatform(term, state) {
    setErr('');
    const wantBsky = state === 'bluesky' || state === 'both';
    const wantTwitter = state === 'twitter' || state === 'both';
    const createdBy = await currentUserEmail();

    async function apply(row, kind, want) {
      if (row) {
        if (row.enabled === want) return;
        const { error } = await supabaseLfe.from('scraper_sources').update({ enabled: want }).eq('id', row.id);
        if (error) throw error;
      } else if (want) {
        const { error } = await supabaseLfe
          .from('scraper_sources')
          .insert({ event_id: eventId, kind, value: term.value, created_by: createdBy });
        if (error) throw error;
      }
    }

    try {
      await apply(term.bskyRow, 'bluesky', wantBsky);
      await apply(term.twRow, 'twitter', wantTwitter);
    } catch (e) {
      setErr(e.message);
    }
    load();
  }

  async function removeTerm(term) {
    const ids = [term.bskyRow?.id, term.twRow?.id].filter(Boolean);
    await supabaseLfe.from('scraper_sources').delete().in('id', ids);
    load();
  }

  async function toggleFeed(row) {
    await supabaseLfe.from('scraper_sources').update({ enabled: !row.enabled }).eq('id', row.id);
    load();
  }

  async function removeFeed(row) {
    await supabaseLfe.from('scraper_sources').delete().eq('id', row.id);
    load();
  }

  const termMap = new Map();
  for (const r of rows) {
    if (r.kind !== 'bluesky' && r.kind !== 'twitter') continue;
    const key = r.value.trim().toLowerCase();
    const entry = termMap.get(key) ?? { value: r.value, bskyRow: null, twRow: null };
    if (r.kind === 'bluesky') entry.bskyRow = r; else entry.twRow = r;
    termMap.set(key, entry);
  }
  const terms = [...termMap.values()].sort((a, b) => a.value.localeCompare(b.value));
  const feeds = rows.filter((r) => r.kind === 'rss');

  return (
    <div className="panel-scroll">
      <div className="panel-inner">
        <h1>Scraper keywords and feeds</h1>
        <p className="muted">
          The automated pipeline reads this list on its next run. Add a search
          term (in this event's language) and choose which platform(s) it
          watches, plus any news / RSS feed URLs.
        </p>

        <h3>Search terms ({terms.length})</h3>
        <form onSubmit={addTerm} className="inline-form">
          <input
            type="text"
            value={newTerm}
            onChange={(e) => setNewTerm(e.target.value)}
            placeholder="e.g. earthquake, or a local-language term"
          />
          <select value={newTermPlatform} onChange={(e) => setNewTermPlatform(e.target.value)}>
            <option value="bluesky">Bluesky</option>
            <option value="twitter">X / Twitter</option>
            <option value="both">Both</option>
          </select>
          <button className="btn" type="submit">Add</button>
        </form>
        {err && <p className="status-line err">{err}</p>}

        {loading ? (
          <p className="muted">Loading...</p>
        ) : (
          <>
            {terms.length === 0 && <p className="muted">None yet.</p>}
            {terms.map((term) => (
              <div key={term.value.toLowerCase()} className={`source-row ${termState(term) === 'inactive' ? 'disabled' : ''}`}>
                <span className="val" title={term.value}>{term.value}</span>
                <select value={termState(term)} onChange={(e) => setTermPlatform(term, e.target.value)}>
                  {TERM_STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <button className="mini danger" onClick={() => removeTerm(term)}>Remove</button>
              </div>
            ))}

            <h3 className="feeds-heading">News / RSS feeds ({feeds.length})</h3>
            <form onSubmit={addFeed} className="inline-form">
              <input
                type="text"
                value={newFeed}
                onChange={(e) => setNewFeed(e.target.value)}
                placeholder="https://.../rss.xml"
              />
              <button className="btn" type="submit">Add</button>
            </form>
            {feeds.length === 0 && <p className="muted">None yet.</p>}
            {feeds.map((r) => (
              <SourceRow key={r.id} row={r} onToggle={toggleFeed} onRemove={removeFeed} />
            ))}
          </>
        )}

        <p className="muted small">
          Tip: a dedicated public hashtag (for example a campaign tag your team
          promotes) makes crowdsourced Bluesky and X/Twitter posts far easier
          to find and geolocate.
        </p>
      </div>
    </div>
  );
}

function SourceRow({ row, onToggle, onRemove }) {
  return (
    <div className={`source-row ${row.enabled ? '' : 'disabled'}`}>
      <span className="val" title={row.value}>{row.value}</span>
      <button className="mini" onClick={() => onToggle(row)}>
        {row.enabled ? 'Enabled' : 'Paused'}
      </button>
      <button className="mini danger" onClick={() => onRemove(row)}>Remove</button>
    </div>
  );
}
