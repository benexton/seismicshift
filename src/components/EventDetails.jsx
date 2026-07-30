import { useEffect, useState } from 'react';
import {
  supabase, EVENT_META_ID, EVENT_META_MAP, metaRowToCamel, camelToMetaRow,
} from '../lib/supabase.js';

const EMPTY = Object.fromEntries(EVENT_META_MAP.map(([, key]) => [key, '']));

/**
 * Single source of truth for the event's key facts. Reads and writes the one
 * row in event_meta. The Report generator pulls the same row, so these values
 * are entered once and stay consistent across everyone's draft reports.
 */
export default function EventDetails({ reviewer }) {
  const [meta, setMeta] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('event_meta').select('*').eq('id', EVENT_META_ID).maybeSingle();
      setLoading(false);
      if (error) return setStatus({ kind: 'err', msg: error.message });
      if (data) setMeta(metaRowToCamel(data));
    })();
  }, []);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    const row = { ...camelToMetaRow(meta), updated_by: reviewer, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('event_meta').upsert(row, { onConflict: 'id' });
    setSaving(false);
    setStatus(error
      ? { kind: 'err', msg: `Save failed: ${error.message}` }
      : { kind: 'ok', msg: 'Saved. The report will use these values.' });
  }

  const set = (key) => (e) => setMeta((m) => ({ ...m, [key]: e.target.value }));

  return (
    <div className="panel-scroll">
      <div className="panel-inner">
        <h1>Event details</h1>
        <p className="muted">
          The key facts for this earthquake. Set them once here; the report
          header reads from this, so nobody has to retype them. Update in one
          place if an official figure is revised.
        </p>

        {loading ? (
          <p className="muted">Loading...</p>
        ) : (
          <form onSubmit={save}>
            <div className="report-meta">
              {EVENT_META_MAP.filter(([col]) => col !== 'contributors').map(([, key, label]) => (
                <div key={key}>
                  <label htmlFor={key}>{label}</label>
                  <input id={key} type="text" value={meta[key] ?? ''} onChange={set(key)} />
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="contributors">Contributors</label>
                <input id="contributors" type="text" value={meta.contributors ?? ''} onChange={set('contributors')} />
              </div>
            </div>
            <div className="report-actions">
              <button className="btn" type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save event details'}
              </button>
              {status && <span className={`status-line ${status.kind}`}>{status.msg}</span>}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
