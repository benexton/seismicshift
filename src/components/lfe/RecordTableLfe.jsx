import { useState } from 'react';
import { createPortal } from 'react-dom';
import { DAMAGE_LABEL, DAMAGE_COLOR, observationTypesLabel, provenanceLabel } from '../../lib/constantsLfe.js';

/**
 * Table view of the (filtered) records for a tab, with key metadata and a
 * thumbnail that enlarges on hover. Clicking a row opens the same panel as the
 * map. `mode` picks the final column (submitter for the queue, verifier for
 * triaged sites). The Type column joins all ticked observation types.
 */
export default function RecordTableLfe({ records, mode, othersByRecord, onOpen }) {
  const isPublic = mode === 'public';
  const personHeader = mode === 'triaged' ? 'Verified by' : 'Submitted by';
  const [preview, setPreview] = useState(null);

  return (
    <div className="record-table-wrap">
      <table className="record-table">
        <thead>
          <tr>
            <th className="thumb-th"></th>
            <th>Site</th><th>Region</th><th>Damage</th><th>Type</th>
            <th>Non-struct.</th>
            {!isPublic && <><th>Source</th><th>{personHeader}</th></>}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => {
            const others = othersByRecord?.get(r.id) ?? [];
            return (
              <tr key={r.id} className={others.length ? 'in-use' : ''} onClick={() => onOpen(r)}>
                <td className="thumb-td">
                  {r.media_url && (
                    <img className="thumb-small" src={r.media_url} alt=""
                      onMouseEnter={(e) => setPreview({ src: r.media_url, x: e.clientX, y: e.clientY })}
                      onMouseMove={(e) => setPreview((p) => (p ? { ...p, x: e.clientX, y: e.clientY } : p))}
                      onMouseLeave={() => setPreview(null)} />
                  )}
                </td>
                <td>#{r.site_id ?? '-'}</td>
                <td>{r.region ?? '-'}</td>
                <td>
                  <span className="dmg-chip" style={{ background: DAMAGE_COLOR[r.damage_score] ?? '#9e9e9e' }}>
                    {DAMAGE_LABEL[r.damage_score]?.split(' - ')[0] ?? '-'}
                  </span>
                </td>
                <td>{observationTypesLabel(r.observation_types)}</td>
                <td>{r.nonstructural_damage ? 'Yes' : ''}</td>
                {!isPublic && <td>{provenanceLabel(r)}</td>}
                {!isPublic && (
                  <td>
                    {mode === 'triaged' ? (r.reviewed_by ?? '-') : (r.submitted_by ?? '-')}
                    {others.length ? <span className="muted"> · in use by {others.join(', ')}</span> : null}
                  </td>
                )}
              </tr>
            );
          })}
          {records.length === 0 && (
            <tr><td colSpan={isPublic ? 6 : 8} className="muted" style={{ textAlign: 'center', padding: 20 }}>No records match.</td></tr>
          )}
        </tbody>
      </table>

      {preview && createPortal(
        <img className="thumb-preview" src={preview.src} alt=""
          style={{ left: Math.min(preview.x + 16, window.innerWidth - 260), top: Math.min(preview.y + 16, window.innerHeight - 260) }} />,
        document.body,
      )}
    </div>
  );
}
