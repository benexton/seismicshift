import { useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabaseLfe } from '../../lib/supabaseLfe.js';
import { useEvent, basemapEntries, mapCenterOf, epicentreOf } from '../../lib/useEvent.js';
import RecordFieldsLfe, { fieldsPatch } from './RecordFieldsLfe.jsx';
import { uploadImage, uploadFile } from '../../lib/mediaLfe.js';
import { coordError, isFarFromEvent } from '../../lib/coordsLfe.js';

function LocationPicker({ pos, setPos }) {
  useMapEvents({ click: (e) => setPos([e.latlng.lat, e.latlng.lng]) });
  return pos && pos[0] != null && pos[1] != null ? (
    <CircleMarker center={pos} radius={9}
      pathOptions={{ color: '#fff', weight: 2, fillColor: '#1570ef', fillOpacity: 0.9 }} />
  ) : null;
}

// Sensible starting defaults for the common case (matches the pre-refactor
// form's own defaults) - reset to this exact object after each submission so
// a value from one record can't silently leak into the next unrelated one.
const INITIAL_V = {
  observation_types: ['building'],
  damage_score: 2,
  nonstructural_damage: false,
  location_confidence: 'high',
  address: '',
  region: '',
  year_built: '',
  code_era: 'unknown',
  building_name: '',
  building_type: 'residential',
  primary_material: 'reinforced concrete',
  height_class: 'low-rise',
  observed_retrofits: 'none',
  failure_mechanism: '',
  type_details: {},
};

/**
 * Manual observation entry, event-scoped. An engineer sets an exact location
 * (map click or typed coordinates), records building/site attributes and
 * imagery via the same RecordFieldsLfe field set (and order) as the review
 * queue and triaged-site detail views, and submits for a second person to
 * verify. Enters the queue as source_type='human'.
 */
export default function ManualInputLfe({ reviewer }) {
  const { event } = useEvent();
  const eventId = event?.id;
  const options = useMemo(() => basemapEntries(event), [event]);
  const { center } = mapCenterOf(event);
  const epicentre = epicentreOf(event);

  const [pos, setPos] = useState(null);
  const [basemap, setBasemap] = useState(options[0]?.[0] ?? '');
  const [v, setV] = useState(INITIAL_V);
  const [notes, setNotes] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [links, setLinks] = useState([]);
  const [linkDraft, setLinkDraft] = useState('');
  const [images, setImages] = useState([]);
  const [docs, setDocs] = useState([]);
  const [streetview, setStreetview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [farConfirm, setFarConfirm] = useState(false);
  const [submittedSite, setSubmittedSite] = useState(null);
  const [showWarning, setShowWarning] = useState(true);

  const set = (key) => (e) => setV((m) => ({ ...m, [key]: e.target.value }));

  function setLat(val) { setFarConfirm(false); const n = val === '' ? null : Number(val); setPos((p) => [n, p ? p[1] : center[1]]); }
  function setLng(val) { setFarConfirm(false); const n = val === '' ? null : Number(val); setPos((p) => [p ? p[0] : center[0], n]); }
  function addLink() { const v2 = linkDraft.trim(); if (v2) { setLinks((l) => [...l, v2]); setLinkDraft(''); } }

  async function submit(e) {
    e.preventDefault();
    const cErr = coordError(pos?.[0], pos?.[1]);
    if (cErr) return setStatus({ kind: 'err', msg: cErr });
    if (isFarFromEvent(pos[0], pos[1], epicentre) && !farConfirm) {
      setFarConfirm(true);
      return setStatus({ kind: 'err', msg: `This point looks far from ${event?.name ?? 'the event'} (${Number(pos[0]).toFixed(4)}, ${Number(pos[1]).toFixed(4)}). If that is correct, click Submit again to confirm.` });
    }
    setBusy(true);
    setStatus(null);
    try {
      const imageUrls = [];
      for (const f of images) imageUrls.push(await uploadImage(f));
      const mediaUrl = imageUrls[0] ?? null;
      const streetviewUrl = streetview ? await uploadImage(streetview) : null;

      const patch = fieldsPatch(v);
      const { data: newId, error } = await supabaseLfe.rpc('submit_observation', {
        p_event_id: eventId,
        p_lng: pos[1], p_lat: pos[0],
        p_observation_types: patch.observation_types,
        p_region: patch.region,
        p_media_url: mediaUrl,
        p_source_url: sourceUrl || null,
        p_damage_score: patch.damage_score,
        p_code_era: patch.code_era,
        p_year_built: patch.year_built,
        p_failure_mechanism: patch.failure_mechanism,
        p_observed_retrofits: patch.observed_retrofits,
        p_notes: notes || null,
        p_submitted_by: reviewer,
        p_building_name: patch.building_name,
        p_address: patch.address,
        p_location_confidence: patch.location_confidence,
        p_streetview_url: streetviewUrl,
        p_building_type: patch.building_type,
        p_primary_material: patch.primary_material,
        p_height_class: patch.height_class,
        p_type_details: patch.type_details,
      });
      if (error) throw error;

      const fileRows = [];
      for (const f of docs) {
        const url = await uploadFile(f);
        fileRows.push({ record_id: newId, file_url: url, file_name: f.name, added_by: reviewer });
      }
      const attachRows = [
        ...imageUrls.slice(1).map((u) => ({ record_id: newId, media_url: u, added_by: reviewer })),
        ...links.map((l) => ({ record_id: newId, source_url: l, added_by: reviewer })),
        ...fileRows,
      ];
      if (attachRows.length && newId) {
        const att = await supabaseLfe.from('record_attachments').insert(attachRows);
        if (att.error) throw att.error;
      }
      if (patch.nonstructural_damage && newId) {
        const ns = await supabaseLfe.from('triage_records').update({ nonstructural_damage: true }).eq('id', newId);
        if (ns.error) throw ns.error;
      }

      // assign_site_id() runs as a BEFORE INSERT trigger, so site_id is
      // already set on the row by the time submit_observation returns its id.
      let siteNum = null;
      if (newId) {
        const site = await supabaseLfe.from('triage_records').select('site_id').eq('id', newId).single();
        siteNum = site.data?.site_id ?? null;
      }

      setStatus(null);
      setPos(null);
      setV(INITIAL_V);
      setNotes(''); setSourceUrl(''); setLinks([]); setImages([]); setDocs([]); setStreetview(null); setFarConfirm(false);
      setSubmittedSite(siteNum ?? true);
    } catch (ex) {
      setStatus({ kind: 'err', msg: `Submit failed: ${ex.message ?? ex}` });
    } finally {
      setBusy(false);
    }
  }

  function submitAnother() { setSubmittedSite(null); }

  const base = options.find(([k]) => k === basemap)?.[1];
  const lat = pos && pos[0] != null ? pos[0] : '';
  const lng = pos && pos[1] != null ? pos[1] : '';

  return (
    <div className="panel-scroll">
      <div className="panel-inner">
        <h1>Manual observation entry</h1>

        {submittedSite ? (
          <div className="submit-confirm">
            <h2>Congratulations - you've successfully submitted{typeof submittedSite === 'number' ? ` site #${submittedSite}` : ' this site'}.</h2>
            <p className="muted">It has been added to the triage queue for a second volunteer to verify.</p>
            <button className="btn" onClick={submitAnother}>Submit another observation</button>
          </div>
        ) : (
        <>
        <p className="muted">
          Set the exact location, record what you observed, and submit. It enters
          the queue for a second volunteer to verify.
        </p>

        <div className="manual-grid">
          <div>
            <label className="fld-label">Location</label>
            <div className="mini-map">
              <MapContainer center={center} zoom={10} className="mini-map-inner" scrollWheelZoom zoomAnimation={false}>
                {base && <TileLayer url={base.url} attribution={base.attribution ?? ''} maxZoom={18} />}
                <LocationPicker pos={pos} setPos={setPos} />
              </MapContainer>
              <div className="map-controls">
                <label htmlFor="mi-bm">Basemap</label>
                <select id="mi-bm" value={basemap} onChange={(e) => setBasemap(e.target.value)}>
                  {options.map(([k, val]) => <option key={k} value={k}>{val.label}</option>)}
                </select>
              </div>
            </div>
            <p className="muted small">
              {pos && pos[0] != null && pos[1] != null
                ? 'Pin set. Fine-tune the numbers in the fields on the right if needed.'
                : 'Click the map, or set coordinates in the fields on the right.'}
            </p>

            <div className="field">
              <label>Photos</label>
              <input type="file" accept="image/*" multiple onChange={(e) => setImages(Array.from(e.target.files ?? []))} />
              {images.length > 0 && <span className="muted small">{images.length} image(s) selected. The first is the primary photo.</span>}
            </div>

            <div className="field">
              <label>Files (PDF, docs, etc.)</label>
              <input type="file" multiple onChange={(e) => setDocs(Array.from(e.target.files ?? []))} />
              {docs.length > 0 && <span className="muted small">{docs.length} file(s) selected.</span>}
            </div>

            <div className="field">
              <label>Street View screenshot</label>
              <input type="file" accept="image/*" onChange={(e) => setStreetview(e.target.files?.[0] ?? null)} />
              <span className="muted small">A screenshot from Google Street View, if available.</span>
            </div>

            <div className="field">
              <label>Primary source link</label>
              <input type="text" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..." />
            </div>

            <div className="field">
              <label>Additional links</label>
              <div className="link-add">
                <input type="text" value={linkDraft} onChange={(e) => setLinkDraft(e.target.value)}
                  placeholder="https://..." onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }} />
                <button type="button" className="mini" onClick={addLink}>Add</button>
              </div>
              {links.map((l, i) => (
                <div key={i} className="link-row">
                  <span title={l}>{l}</span>
                  <button type="button" className="mini danger" onClick={() => setLinks((ls) => ls.filter((_, j) => j !== i))}>Remove</button>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={submit} className="manual-form">
            <RecordFieldsLfe
              v={v} set={set} country={event?.country}
              lat={lat} lng={lng}
              onLatChange={(e) => setLat(e.target.value)} onLngChange={(e) => setLng(e.target.value)}
            />

            <div className="field">
              <label>Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Observed behaviour, context, caveats..." />
            </div>

            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Submitting...' : 'Submit for verification'}
            </button>
            {status && <p className={`status-line ${status.kind}`}>{status.msg}</p>}
          </form>
        </div>
        </>
        )}
      </div>

      {showWarning && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="head">
              <h2>Check before you enter a new site</h2>
            </div>
            <div className="body" style={{ display: 'block' }}>
              <p>
                Before entering a manual input, please check through the sites already
                sitting in the <b>Triaged sites</b> tab or the <b>Triage queue</b>. If your
                site already exists, please add information to the existing record rather
                than creating a new manual entry.
              </p>
            </div>
            <div className="foot">
              <span className="grow" />
              <button className="btn" onClick={() => setShowWarning(false)}>Continue</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
