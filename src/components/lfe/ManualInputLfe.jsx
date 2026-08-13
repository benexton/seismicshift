import { useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabaseLfe } from '../../lib/supabaseLfe.js';
import { useEvent, basemapEntries, mapCenterOf, epicentreOf } from '../../lib/useEvent.js';
import {
  CLASSIFICATION_SCORES, DAMAGE_LABEL, CODE_ERAS, RETROFIT_OPTIONS,
  OBSERVATION_TYPES, OBSERVATION_LABEL, TYPE_DETAIL_FIELDS,
  LOCATION_CONFIDENCE, BUILDING_TYPES, PRIMARY_MATERIALS, HEIGHT_CLASSES, cap,
} from '../../lib/constantsLfe.js';
import { uploadImage, uploadFile } from '../../lib/mediaLfe.js';
import { coordError, isFarFromEvent } from '../../lib/coordsLfe.js';

function LocationPicker({ pos, setPos }) {
  useMapEvents({ click: (e) => setPos([e.latlng.lat, e.latlng.lng]) });
  return pos && pos[0] != null && pos[1] != null ? (
    <CircleMarker center={pos} radius={9}
      pathOptions={{ color: '#fff', weight: 2, fillColor: '#1570ef', fillOpacity: 0.9 }} />
  ) : null;
}

/**
 * Manual observation entry, event-scoped. An engineer sets an exact location
 * (map click or typed coordinates), records building/site attributes and
 * imagery, and submits for a second person to verify. Enters the queue as
 * source_type='human'.
 */
export default function ManualInputLfe({ reviewer }) {
  const { event } = useEvent();
  const eventId = event?.id;
  const options = useMemo(() => basemapEntries(event), [event]);
  const { center } = mapCenterOf(event);
  const epicentre = epicentreOf(event);

  const [pos, setPos] = useState(null);
  const [basemap, setBasemap] = useState(options[0]?.[0] ?? '');
  const [obsTypes, setObsTypes] = useState(['building']);
  const [typeDetails, setTypeDetailsState] = useState({});
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
  const [docs, setDocs] = useState([]);
  const [streetview, setStreetview] = useState(null);
  const [nonstructural, setNonstructural] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [farConfirm, setFarConfirm] = useState(false);
  const [submittedSite, setSubmittedSite] = useState(null);
  const [showWarning, setShowWarning] = useState(true);

  const isBuilding = obsTypes.includes('building');

  function setLat(v) { setFarConfirm(false); const n = v === '' ? null : Number(v); setPos((p) => [n, p ? p[1] : center[1]]); }
  function setLng(v) { setFarConfirm(false); const n = v === '' ? null : Number(v); setPos((p) => [p ? p[0] : center[0], n]); }
  function addLink() { const v = linkDraft.trim(); if (v) { setLinks((l) => [...l, v]); setLinkDraft(''); } }
  function toggleObsType(t) {
    setObsTypes((prev) => {
      const next = prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t];
      return next.length ? next : [t];
    });
  }
  function setTypeDetail(type, key) {
    return (e) => {
      setTypeDetailsState((prev) => ({ ...prev, [type]: { ...(prev[type] ?? {}), [key]: e.target.value } }));
    };
  }

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

      const { data: newId, error } = await supabaseLfe.rpc('submit_observation', {
        p_event_id: eventId,
        p_lng: pos[1], p_lat: pos[0],
        p_observation_types: obsTypes,
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
        p_type_details: Object.fromEntries(Object.entries(typeDetails).filter(([t]) => obsTypes.includes(t))),
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
      if (nonstructural && newId) {
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
      setPos(null); setObsTypes(['building']); setTypeDetailsState({}); setRegion(''); setAddress(''); setBuildingName(''); setMechanism('');
      setNotes(''); setSourceUrl(''); setLinks([]); setImages([]); setDocs([]); setStreetview(null); setNonstructural(false); setFarConfirm(false);
      // Reset every field that carries a non-empty default, so it can't
      // silently leak into the next, unrelated submission (e.g. a D4/URM
      // building's damage score and material being left set while the next
      // record only changes the pin and photo).
      setLocConfidence('high'); setBuildingType('residential'); setMaterial('reinforced concrete');
      setHeightClass('low-rise'); setDamage(2); setCodeEra('unknown'); setRetrofit('none');
      setSubmittedSite(siteNum ?? true);
    } catch (ex) {
      setStatus({ kind: 'err', msg: `Submit failed: ${ex.message ?? ex}` });
    } finally {
      setBusy(false);
    }
  }

  function submitAnother() { setSubmittedSite(null); }

  const base = options.find(([k]) => k === basemap)?.[1];

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
                  {options.map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
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
              <label>Observation type (tick all that apply)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {OBSERVATION_TYPES.map((t) => (
                  <label key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontWeight: 600, cursor: 'pointer' }}>
                    <input type="checkbox" checked={obsTypes.includes(t)} onChange={() => toggleObsType(t)} style={{ width: 'auto', flexShrink: 0, marginTop: 3 }} />
                    <span>{OBSERVATION_LABEL[t]}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Region / area</label>
              <input type="text" value={region} onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g. a suburb or district name" />
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

            {obsTypes.filter((t) => TYPE_DETAIL_FIELDS[t]).map((t) => (
              <div key={t} style={{ borderTop: '1px solid #e5e7eb', paddingTop: 8, marginTop: 4 }}>
                <div className="fld-label">{OBSERVATION_LABEL[t]} details</div>
                {TYPE_DETAIL_FIELDS[t].map(([key, label, opts]) => (
                  <div className="field" key={key}>
                    <label>{label}</label>
                    {opts ? (
                      <select value={typeDetails[t]?.[key] ?? ''} onChange={setTypeDetail(t, key)}>
                        <option value="">-</option>
                        {opts.map((o) => <option key={o} value={o}>{cap(o)}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={typeDetails[t]?.[key] ?? ''} onChange={setTypeDetail(t, key)} />
                    )}
                  </div>
                ))}
              </div>
            ))}

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
              <label>Files (PDF, docs, etc.)</label>
              <input type="file" multiple onChange={(e) => setDocs(Array.from(e.target.files ?? []))} />
              {docs.length > 0 && <span className="muted small">{docs.length} file(s) selected.</span>}
            </div>

            <div className="field">
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, cursor: 'pointer' }}>
                <input type="checkbox" checked={nonstructural} onChange={(e) => setNonstructural(e.target.checked)} style={{ width: 'auto', flexShrink: 0 }} />
                <span>Damage to non-structural elements?</span>
              </label>
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
