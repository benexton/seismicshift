import { useEffect, useState } from 'react';
import { supabaseLfe } from '../../lib/supabaseLfe.js';
import { useEvent } from '../../lib/useEvent.js';

/**
 * Manage what the automated pipeline watches for this event. Rows written
 * here are read by scripts/lfe/ingest_triage_data.py on its next run, so
 * changing keywords or feeds needs no code edit. Two kinds: 'bluesky'
 * (search terms) and 'rss' (feed URLs).
 */
export default function ScraperConfigLfe() {
  const { event } = useEvent();
  const eventId = event?.id;
  const [rows, setRows] = useState([]);
  const [kind, setKind] = useState('bluesky');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  async function load() {
    if (!eventId) return;
    setLoading(true);
    const { data, error } = await supabaseLfe
      .from('scraper_sources')
      .select('id, kind, value, enabled, created_at')
      .eq('event_id', eventId)
      .order('kind', { ascending: true })
      .order('created_at', { ascending: true });
    setLoading(false);
    if (error) return setErr(error.message);
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function add(e) {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    setErr('');
    const { data: u } = await supabaseLfe.auth.getUser();
    const { error } = await supabaseLfe
      .from('scraper_sources')
      .insert({ event_id: eventId, kind, value: v, created_by: u?.user?.email ?? null });
    if (error) return setErr(error.message);
    setValue('');
    load();
  }

  async function toggle(row) {
    await supabaseLfe.from('scraper_sources').update({ enabled: !row.enabled }).eq('id', row.id);
    load();
  }

  async function remove(row) {
    await supabaseLfe.from('scraper_sources').delete().eq('id', row.id);
    load();
  }

  const bluesky = rows.filter((r) => r.kind === 'bluesky');
  const rss = rows.filter((r) => r.kind === 'rss');

  return (
    <div className="panel-scroll">
      <div className="panel-inner">
        <h1>Scraper keywords and feeds</h1>
        <p className="muted">
          The automated pipeline reads this list on its next run. Add Bluesky
          search terms (in this event's language) and news / RSS feed URLs.
          Disable a row to pause it without deleting.
        </p>

        <form onSubmit={add} className="inline-form">
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="bluesky">Bluesky search term</option>
            <option value="rss">RSS feed URL</option>
          </select>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={kind === 'bluesky' ? 'e.g. earthquake, or a local-language term' : 'https://.../rss.xml'}
          />
          <button className="btn" type="submit">Add</button>
        </form>
        {err && <p className="status-line err">{err}</p>}

        {loading ? (
          <p className="muted">Loading...</p>
        ) : (
          <div className="two-col">
            <div>
              <h3>Bluesky search terms ({bluesky.length})</h3>
              {bluesky.length === 0 && <p className="muted">None yet.</p>}
              {bluesky.map((r) => (
                <SourceRow key={r.id} row={r} onToggle={toggle} onRemove={remove} />
              ))}
            </div>
            <div>
              <h3>News / RSS feeds ({rss.length})</h3>
              {rss.length === 0 && <p className="muted">None yet.</p>}
              {rss.map((r) => (
                <SourceRow key={r.id} row={r} onToggle={toggle} onRemove={remove} />
              ))}
            </div>
          </div>
        )}

        <p className="muted small">
          Tip: a dedicated public hashtag (for example a campaign tag your team
          promotes) makes crowdsourced Bluesky posts far easier to find and
          geolocate.
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
