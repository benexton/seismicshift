import { DAMAGE_LABEL, DAMAGE_COLOR, OBSERVATION_LABEL, provenanceLabel } from '../lib/constants.js';

/**
 * Table view of the (filtered) records for a tab, with key metadata. Clicking a
 * row opens the same review / detail panel as the map. `mode` picks the final
 * column (submitter for the queue, verifier for triaged sites).
 */
export default function RecordTable({ records, mode, othersByRecord, onOpen }) {
  const personHeader = mode === 'triaged' ? 'Verified by' : 'Submitted by';
  return (
    <div className="record-table-wrap">
      <table className="record-table">
        <thead>
          <tr>
            <th>Site</th><th>Region</th><th>Damage</th><th>Type</th>
            <th>Non-struct.</th><th>Source</th><th>{personHeader}</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => {
            const others = othersByRecord?.get(r.id) ?? [];
            return (
              <tr key={r.id} className={others.length ? 'in-use' : ''} onClick={() => onOpen(r)}>
                <td>#{r.site_id ?? '-'}</td>
                <td>{r.region ?? '-'}</td>
                <td>
                  <span className="dmg-chip" style={{ background: DAMAGE_COLOR[r.damage_score] ?? '#9e9e9e' }}>
                    {DAMAGE_LABEL[r.damage_score]?.split(' - ')[0] ?? '-'}
                  </span>
                </td>
                <td>{OBSERVATION_LABEL[r.observation_type] ?? '-'}</td>
                <td>{r.nonstructural_damage ? 'Yes' : ''}</td>
                <td>{provenanceLabel(r)}</td>
                <td>
                  {mode === 'triaged' ? (r.reviewed_by ?? '-') : (r.submitted_by ?? '-')}
                  {others.length ? <span className="muted"> · in use by {others.join(', ')}</span> : null}
                </td>
              </tr>
            );
          })}
          {records.length === 0 && (
            <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 20 }}>No records match.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
