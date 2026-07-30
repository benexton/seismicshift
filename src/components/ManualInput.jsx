import { useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase, MEDIA_BUCKET } from '../lib/supabase.js';
import {
  DAMAGE_SCORES, DAMAGE_LABEL, CODE_ERAS, RETROFIT_OPTIONS,
  OBSERVATION_TYPES, OBSERVATION_LABEL,
} from '../lib/constants.js';

const GSI_PHOTO = 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg';
const GSI_ATTRIB =
  '&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">地理院タイル (GSI Japan)</a>';
const CENTER = [32.79, 130.74];

function LocationPicker({ pos, setPos }) {
  useMapEvents({ click: (e) => setPos([e.latlng.lat, e.latlng.lng]) });
  return pos ? (
    <CircleMarker center={pos} radius={9}
      pathOptions={{ color: '#fff', weight: 2, fillColor: '#1570ef', fillOpacity: 0.9 }} />
  ) : null;
}

/**
 * Manual observation entry. An engineer drops a pin (exact coordinates), fills
 * the parameters, optionally uploads a photo, and submits. The record enters the
 * queue as source_type='human', status='Unverified', for a second person to
 * verify. Supports building AND non-building observation types.
 */
export default function ManualInput({ reviewer }) {
  const [pos, setPos] = useState(null);
  const [obsType, setObsType] = useState('building');
  const [region, setRegion] = useState('');
  const [damage, setDamage] = useState(2);
  const [codeEra, setCodeEra] = useState('unknown');
  const [mechanism, setMechanism] = useState('');
  const [retrofit, setRetrofit] = useState('none');
  const [notes, setNotes] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  const isBuilding = obsType === 'building';

  async function submit(e) {
    e.preventDefault();
    if (!pos) return setStatus({ kind: 'err', msg: 'Click the map to set a location first.' });
    setBusy(true);
    setStatus(null);
    try {
      // 1. optional photo upload to Supabase Storage
      let mediaUrl = null;
      if (file) {
        const path = `${Date.now()}_${file.name.replace(/[^\w.\-]/g, '_')}`;
        const up = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { upsert: false });
        if (up.error) throw up.error;
        mediaUrl = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
      }
      // 2. insert via the SECURITY DEFINER RPC
      const { error } = await supabase.rpc('submit_observation', {
        p_lng: pos[1], p_lat: pos[0],
        p_observation_type: obsType,
        p_region: region || null,
        p_media_url: mediaUrl,
        p_source_url: sourceUrl || null,
        p_structural_type: null,
        p_damage_score: Number(damage),
        p_code_era: isBuilding ? codeEra : null,
        p_failure_mechanism: mechanism || null,
        p_observed_retrofits: isBuilding ? retrofit : null,
        p_notes: notes || null,
        p_submitted_by: reviewer,
      });
      if (error) throw error;
      setStatus({ kind: 'ok', msg: 'Submitted to the triage queue for verification.' });
      // reset the transient fields, keep map centred
      setPos(null); setRegion(''); setMechanism(''); setNotes(''); setSourceUrl(''); setFile(null);
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
          Drop a pin for the exact location, fill in what you observed, and submit.
          It enters the queue for a second volunteer to verify.
        </p>

        <div className="manual-grid">
          <div>
            <label className="fld-label">Location (click the map)</label>
            <div className="mini-map">
              <MapContainer center={CENTER} zoom={10} className="mini-map-inner" scrollWheelZoom>
                <TileLayer url={GSI_PHOTO} attribution={GSI_ATTRIB} maxZoom={18} />
                <LocationPicker pos={pos} setPos={setPos} />
              </MapContainer>
            </div>
            <p className="muted small">
              {pos ? `Selected: ${pos[0].toFixed(5)}, ${pos[1].toFixed(5)}` : 'No location set yet.'}
            </p>
          </div>

          <form onSubmit={submit} className="manual-form">
            <div className="field">
              <label>Observation type</label>
              <select value={obsType} onChange={(e) => setObsType(e.target.value)}>
                {OBSERVATION_TYPES.map((t) => (
                  <option key={t} value={t}>{OBSERVATION_LABEL[t]}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Region / area</label>
              <input type="text" value={region} onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g. Mashiki, Kumamoto" />
            </div>

            <div className="field">
              <label>Damage / severity</label>
              <select value={damage} onChange={(e) => setDamage(e.target.value)}>
                {DAMAGE_SCORES.map((s) => <option key={s} value={s}>{DAMAGE_LABEL[s]}</option>)}
              </select>
            </div>

            {isBuilding && (
              <div className="field">
                <label>Seismic-code era</label>
                <select value={codeEra} onChange={(e) => setCodeEra(e.target.value)}>
                  {CODE_ERAS.map((c) => <option key={c} value={c}>{c}</option>)}
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
                  {RETROFIT_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}

            <div className="field">
              <label>Photo (optional)</label>
              <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>

            <div className="field">
              <label>Source link (optional)</label>
              <input type="text" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..." />
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
