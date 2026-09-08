import { useEffect, useState } from 'react';
import { supabaseLfe, LFE_RECORD_COLUMNS } from '../../lib/supabaseLfe.js';
import { useEvent } from '../../lib/useEvent.js';
import RecordTableLfe from './RecordTableLfe.jsx';

/**
 * Read-only audit list of rejected records for the current event, with the
 * reason each was rejected (see constantsLfe.js's REJECTION_REASONS) - the
 * one place that reason is actually visible anywhere in the app; until now
 * it was captured (ReviewModalLfe) but never displayed. No detail panel -
 * rejected records are already flagged "hard to recover" at reject time,
 * so this is deliberately just a browsable table, not another editing
 * surface for them.
 */
export default function RejectedSitesLfe() {
  const { event } = useEvent();
  const eventId = event?.id;

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // loading already starts true - this effect only runs once per mount in
  // practice (switching events is a real page navigation in this app, not a
  // soft re-mount), so there's no later point where it needs resetting. All
  // setState calls happen inside the .then() callback (deferred), never
  // synchronously in the effect body itself.
  useEffect(() => {
    if (!eventId) return undefined;
    let cancelled = false;
    supabaseLfe.from('triage_records').select(LFE_RECORD_COLUMNS)
      .eq('event_id', eventId).eq('status', 'Rejected')
      .order('reviewed_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoading(false);
        if (error) { setErr(error.message); return; }
        setRecords(data ?? []);
      });
    return () => { cancelled = true; };
  }, [eventId]);

  return (
    <div className="panel-scroll">
      <div className="panel-inner">
        <h1>Rejected records</h1>
        <p className="muted">
          Records rejected during review, with why - an audit trail, not an editing
          queue. Rejected records are hard to recover.
        </p>
        {loading ? (
          <p className="muted">Loading...</p>
        ) : (
          <>
            {err && <p className="status-line err">{err}</p>}
            <RecordTableLfe records={records} mode="rejected" onOpen={() => {}} />
          </>
        )}
      </div>
    </div>
  );
}
