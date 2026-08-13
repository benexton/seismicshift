import Zoomable from '../Zoomable.jsx';

/**
 * Google Street View screenshot field, shared by the triage-queue review
 * panel and the triaged-site detail panel so both can add or replace a
 * screenshot after the record was first created (previously only settable
 * at manual-entry time). `url` is the currently-saved streetview_url, if
 * any; `file` is a locally-chosen replacement not yet saved; `onFile` is
 * called with the chosen File (or null to clear the pending choice).
 */
export default function StreetviewFieldLfe({ url, file, onFile }) {
  return (
    <div className="field">
      <label>Street View screenshot</label>
      {url && !file && (
        <p className="kv">
          <Zoomable className="thumb-small" src={url} alt="Street View screenshot" />{' '}
          <a href={url} target="_blank" rel="noreferrer">open full size</a>
        </p>
      )}
      <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      {file && <span className="muted small">{file.name} selected - click Save to upload it.</span>}
      {!url && !file && <span className="muted small">None on file. Add a screenshot from Google Street View if available.</span>}
    </div>
  );
}
