import { useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase, MEDIA_BUCKET } from '../lib/supabase.js';
import {
  CLASSIFICATION_SCORES, DAMAGE_LABEL, CODE_ERAS, RETROFIT_OPTIONS,
  OBSERVATION_TYPES, OBSERVATION_LABEL,
  LOCATION_CONFIDENCE, BUILDING_TYPES, PRIMARY_MATERIALS, HEIGHT_CLASSES, cap,
} from '../lib/constants.js';
import { uploadImage } from '../lib/media.js';

const GSI_PHOTO = 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg';
const GSI_ATTRIB =
  '&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">地理院タイル (GSI Japan)</a>';
const CENTER = [32.79, 130.74];

function LocationPicker({ pos, setPos }) {
  useMapEvents({ click: (e) => setPos([e.latlng.lat, e.latlng.lng]) });
  return pos && pos[0] != null && pos[1] != null ? (
    <CircleMarker center={pos} radius={9}
      pathOptions={{ color: '#fff', weight: 2, fillColor: '#1570ef', fillOpacity: 0.9 }} />
  ) : null;
}

/**
 * Manual observation entry. An engineer sets an exact location (map click or
 * typed coordinates), records building/site attributes and imagery, and submits
 * for a second person to verify. Enters the queue as source_type='human'.
 */
export default function ManualInput({ reviewer }) {
  const [pos, setPos] = useState(null);
  const [obsType, setObsType] = useState('building');
  const [region, setRegion] = useState('');
  const [address, setAddress] = useState('');
  const [locConfidence, setLocConfidence] = useState('high');
  const [buildingName, setBuildingName] = useState('');
  const [buildingType, setBuildingType] = useState('residential');
  const [material, setMaterial] = useState('reinforced concrete');
  const [heightClass, setHeightClass] = useState('low-rise');
  const [damage, setDamage] = useState(2);
  const [codeEra, setCodeEra] = useState('unknown');
  const [mechanism, setMechanism] = useState('');
  const [retrofit, setRetrofit] = useState('none');
  const [notes, setNotes] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [links, setLinks] = useState([]);
  const [linkDraft, setLinkDraft] = useState('');
  const [images, setImages] = useState([]);
  const [streetview, setStreetview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  const isBuilding = obsType === 'building';

  function setLat(v) { const n = v === '' ? null : Number(v); setPos((p) => [n, p ? p[1] : 130.74]); }
  function setLng(v) { const n = v === '' ? null : Number(v); setPos((p) => [p ? p[0] : 32.79, n]); }
  function addLink() { const v = linkDraft.trim(); if (v) { setLinks((l) => [...l, v]); setLinkDraft(''); } }

  async function submit(e) {
    e.preventDefault();
    if (!pos || pos[0] == null || pos[1] == null || Number.isNaN(pos[0]) || Number.isNaN(pos[1])) {
      return setStatus({ kind: 'err', msg: 'Set a location: click the map or enter both latitude and longitude.' });
    }
    setBusy(true);
    setStatus(null);
    try {
      const imageUrls = [];
      for (const f of images) imageUrls.push(await uploadImage(f));
      const mediaUrl = imageUrls[0] ?? null;
      const streetviewUrl = streetview ? await uploadImage(streetview) : null;

      const { data: newId, error } = await supabase.rpc('submit_observation', {
        p_lng: pos[1], p_lat: pos[0],
        p_observation_type: obsType,
        p_region: region || null,
        p_media_url: mediaUrl,
        p_source_url: sourceUrl || null,
        p_damage_score: Number(damage),
        p_code_era: isBuilding ? codeEra : null,
        p_failure_mechanism: mechanism || null,
        p_observed_retrofits: isBuilding ? retrofit : null,
        p_notes: notes || null,
        p_submitted_by: reviewer,
        p_building_name: isBuilding ? (buildingName || null) : null,
        p_address: address || null,
        p_location_confidence: locConfidence,
        p_streetview_url: streetviewUrl,
        p_building_type: isBuilding ? buildingType : null,
        p_primary_material: isBuilding ? material : null,
        p_height_class: isBuilding ? heightClass : null,
      });
      if (error) throw error;

      const attachRows = [
        ...imageUrls.slice(1).map((u) => ({ record_id: newId, media_url: u, added_by: reviewer })),
        ...links.map((l) => ({ record_id: newId, source_url: l, added_by: reviewer })),
      ];
      if (attachRows.length && newId) {
        const att = await supabase.from('record_attachments').insert(attachRows);
        if (att.error) throw att.error;
      }

      setStatus({ kind: 'ok', msg: 'Submitted to the triage queue for verification.' });
      setPos(null); setRegion(''); setAddress(''); setBuildingName(''); setMechanism('');
      setNotes(''); setSourceUrl(''); setLinks([]); setImages([]); setStreetview(null);
    } catch (ex) {
      setStatus({ kind: 'err', msg: `Submit failed: ${ex.message ?? ex}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel-scroll">
      <div className="panel-inner">
        <h1>Manual observation entry</h1>
        <p className="muted">
          Set the exact location, record what you observed, and submit. It enters
          the queue for a second volunteer to verify.
        </p>

        <div className="manual-grid">
          <div>
            <label className="fld-label">Location</label>
            <div className="mini-map">
              <MapContainer center={CENTER} zoom={10} className="mini-map-inner" scrollWheelZoom>
                <TileLayer url={GSI_PHOTO} attribution={GSI_ATTRIB} maxZoom={18} />
                <LocationPicker pos={pos} setPos={setPos} />
              </MapContainer>
            </div>
            <p className="muted small">
              {pos && pos[0] != null && pos[1] != null
                ? 'Pin set. Fine-tune the numbers below if needed.'
                : 'Click the map, or type coordinates below.'}
            </p>
            <div className="field latlng">
              <div>
                <label>Latitude</label>
                <input type="number" step="0.00001" value={pos && pos[0] != null ? pos[0] : ''}
                  onChange={(e) => setLat(e.target.value)} />
              </div>
              <div>
                <label>Longitude</label>
                <input type="number" step="0.00001" value={pos && pos[1] != null ? pos[1] : ''}
                  onChange={(e) => setLng(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Location confidence</label>
              <select value={locConfidence} onChange={(e) => setLocConfidence(e.target.value)}>
                {LOCATION_CONFIDENCE.map((c) => <option key={c} value={c}>{cap(c)}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Address</label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
                placeholder="Street address if known" />
            </div>
          </div>

          <form onSubmit={submit} className="manual-form">
            <div className="field">
              <label>Observation type</label>
              <select value={obsType} onChange={(e) => setObsType(e.target.value)}>
                {OBSERVATION_TYPES.map((t) => <option key={t} value={t}>{OBSERVATION_LABEL[t]}</option>)}
              </select>
            </div>

            <div className="field">
              <label>Region / area</label>
              <input type="text" value={region} onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g. Mashiki, Kumamoto" />
            </div>

            {isBuilding && (
              <>
                <div className="field">
                  <label>Building name</label>
                  <input type="text" value={buildingName} onChange={(e) => setBuildingName(e.target.value)}
                    placeholder="If known" />
                </div>
                <div className="field">
                  <label>Building type</label>
                  <select value={buildingType} onChange={(e) => setBuildingType(e.target.value)}>
                    {BUILDING_TYPES.map((t) => <option key={t} value={t}>{cap(t)}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Primary material</label>
                  <select value={material} onChange={(e) => setMaterial(e.target.value)}>
                    {PRIMARY_MATERIALS.map((m) => <option key={m} value={m}>{cap(m)}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Height class</label>
                  <select value={heightClass} onChange={(e) => setHeightClass(e.target.value)}>
                    {HEIGHT_CLASSES.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
                  </select>
                </div>
              </>
            )}

            <div className="field">
              <label>Damage / classification</label>
              <select value={damage} onChange={(e) => setDamage(e.target.value)}>
                {CLASSIFICATION_SCORES.map((s) => <option key={s} value={s}>{DAMAGE_LABEL[s]}</option>)}
              </select>
            </div>

            {isBuilding && (
              <div className="field">
                <label>Seismic-code era</label>
                <select value={codeEra} onChange={(e) => setCodeEra(e.target.value)}>
                  {CODE_ERAS.map((c) => <option key={c} value={c}>{cap(c)}</option>)}
                </select>
              </div>
            )}

            <div className="field">
              <label>{isBuilding ? 'Failure mechanism' : 'Mechanism / feature'}</label>
              <input type="text" value={mechanism} onChange={(e) => setMechanism(e.target.value)}
                placeholder={isBuilding ? 'e.g. soft-story collapse' : 'e.g. liquefaction, road washout'} />
            </div>

            {isBuilding && (
              <div className="field">
                <label>Observed retrofits</label>
                <select value={retrofit} onChange={(e) => setRetrofit(e.target.value)}>
                  {RETROFIT_OPTIONS.map((r) => <option key={r} value={r}>{cap(r)}</option>)}
                </select>
              </div>
            )}

            <div className="field">
              <label>Photos</label>
              <input type="file" accept="image/*" multiple onChange={(e) => setImages(Array.from(e.target.files ?? []))} />
              {images.length > 0 && <span className="muted small">{images.length} image(s) selected. The first is the primary photo.</span>}
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
      </div>
    </div>
  );
}
