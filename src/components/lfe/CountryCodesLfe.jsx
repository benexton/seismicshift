import { useEffect, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { supabaseLfe } from '../../lib/supabaseLfe.js';
import LoginGateLfe from './LoginGateLfe.jsx';
import LfeNavGroup from './LfeNavGroup.jsx';

function mdHtml(t) {
  return DOMPurify.sanitize(marked.parse(String(t || '')));
}

function CountryList({ countries, onSelect, onAdd, canWrite }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function add(e) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    setBusy(true); setErr('');
    const ok = await onAdd(clean);
    setBusy(false);
    if (ok) setName(''); else setErr('Could not add - it may already exist.');
  }

  return (
    <div className="panel-scroll">
      <div className="panel-inner">
        <h1>Codes &amp; standards</h1>
        <p className="muted">
          A shared, growing reference of seismic building codes and their history by
          country - written once, reused by every current and future event that
          references that country.
        </p>

        {canWrite && (
          <form onSubmit={add} className="inline-form">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Add a country, e.g. Venezuela" />
            <button className="btn" type="submit" disabled={busy || !name.trim()}>
              {busy ? 'Adding...' : 'Add country'}
            </button>
          </form>
        )}
        {err && <p className="status-line err">{err}</p>}

        {countries.length === 0 && <p className="muted">No countries added yet.</p>}
        <ul className="event-list">
          {countries.map((c) => (
            <li key={c.country}>
              <button className="link-btn" onClick={() => onSelect(c.country)}>{c.country}</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CountryDetail({ country, canWrite, reviewer, onBack }) {
  const [overview, setOverview] = useState('');
  const [overviewDraft, setOverviewDraft] = useState('');
  const [editingOverview, setEditingOverview] = useState(false);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const [yearStart, setYearStart] = useState('');
  const [yearEnd, setYearEnd] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [addBusy, setAddBusy] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [editBusy, setEditBusy] = useState(false);

  async function load() {
    setLoading(true);
    const [c, e] = await Promise.all([
      supabaseLfe.from('country_codes').select('overview_md').eq('country', country).maybeSingle(),
      supabaseLfe.from('country_code_entries').select('*').eq('country', country).order('year_start', { ascending: true }),
    ]);
    setLoading(false);
    const md = c.data?.overview_md || '';
    setOverview(md);
    setOverviewDraft(md);
    setEntries(e.data ?? []);
  }
  useEffect(() => { load(); }, [country]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveOverview() {
    setBusy(true); setStatus(null);
    const { error } = await supabaseLfe.from('country_codes')
      .update({ overview_md: overviewDraft, updated_by: reviewer }).eq('country', country);
    setBusy(false);
    if (error) return setStatus({ kind: 'err', msg: `Save failed: ${error.message}` });
    setOverview(overviewDraft);
    setEditingOverview(false);
  }

  async function addEntry(e) {
    e.preventDefault();
    if (!title.trim() || yearStart === '') return;
    setAddBusy(true); setStatus(null);
    const { error } = await supabaseLfe.from('country_code_entries').insert({
      country,
      year_start: Number(yearStart),
      year_end: yearEnd !== '' ? Number(yearEnd) : null,
      title: title.trim(),
      description: description.trim() || null,
      updated_by: reviewer,
    });
    setAddBusy(false);
    if (error) return setStatus({ kind: 'err', msg: `Add failed: ${error.message}` });
    setYearStart(''); setYearEnd(''); setTitle(''); setDescription('');
    load();
  }

  async function removeEntry(id) {
    const { error } = await supabaseLfe.from('country_code_entries').delete().eq('id', id);
    if (error) return setStatus({ kind: 'err', msg: `Remove failed: ${error.message}` });
    setEntries((prev) => prev.filter((x) => x.id !== id));
  }

  function startEdit(en) {
    setEditingId(en.id);
    setEditDraft({
      year_start: String(en.year_start),
      year_end: en.year_end != null ? String(en.year_end) : '',
      title: en.title,
      description: en.description ?? '',
    });
    setStatus(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  async function saveEdit(id) {
    if (!editDraft.title.trim() || editDraft.year_start === '') return;
    setEditBusy(true); setStatus(null);
    const { error } = await supabaseLfe.from('country_code_entries').update({
      year_start: Number(editDraft.year_start),
      year_end: editDraft.year_end !== '' ? Number(editDraft.year_end) : null,
      title: editDraft.title.trim(),
      description: editDraft.description.trim() || null,
      updated_by: reviewer,
    }).eq('id', id);
    setEditBusy(false);
    if (error) return setStatus({ kind: 'err', msg: `Save failed: ${error.message}` });
    setEditingId(null);
    setEditDraft(null);
    load();
  }

  return (
    <div className="panel-scroll">
      <div className="panel-inner">
        <p><button className="link-btn" onClick={onBack}>&larr; All countries</button></p>
        <h1>{country}</h1>

        {loading ? <p className="muted">Loading...</p> : (
          <>
            <h2>Overview</h2>
            {editingOverview ? (
              <>
                <textarea value={overviewDraft} onChange={(e) => setOverviewDraft(e.target.value)}
                  style={{ width: '100%', minHeight: 160 }}
                  placeholder="Seismotectonic setting, general code history, etc. Markdown supported." />
                <div className="report-actions">
                  <button className="btn" onClick={saveOverview} disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
                  <button className="btn secondary" disabled={busy}
                    onClick={() => { setOverviewDraft(overview); setEditingOverview(false); }}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                {overview
                  ? <div className="report-body" dangerouslySetInnerHTML={{ __html: mdHtml(overview) }} />
                  : <p className="muted">No overview yet.</p>}
                {canWrite && <button className="mini" onClick={() => setEditingOverview(true)}>Edit overview</button>}
              </>
            )}

            <h2 style={{ marginTop: 24 }}>Code timeline</h2>
            {entries.length === 0 && <p className="muted">No code entries yet.</p>}
            {entries.length > 0 && (
              <table className="record-table">
                <thead><tr><th>Year(s)</th><th>Code</th><th>Description</th>{canWrite && <th></th>}</tr></thead>
                <tbody>
                  {entries.map((en) => (
                    editingId === en.id ? (
                      <tr key={en.id}>
                        <td>
                          <input type="number" value={editDraft.year_start}
                            onChange={(e) => setEditDraft((d) => ({ ...d, year_start: e.target.value }))}
                            style={{ width: 80 }} required />
                          <input type="number" placeholder="end (opt.)" value={editDraft.year_end}
                            onChange={(e) => setEditDraft((d) => ({ ...d, year_end: e.target.value }))}
                            style={{ width: 90, marginTop: 4 }} />
                        </td>
                        <td>
                          <input type="text" value={editDraft.title}
                            onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))} required />
                        </td>
                        <td>
                          <input type="text" value={editDraft.description}
                            onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))} />
                        </td>
                        <td>
                          <button className="mini" onClick={() => saveEdit(en.id)} disabled={editBusy}>
                            {editBusy ? 'Saving...' : 'Save'}
                          </button>{' '}
                          <button className="mini" onClick={cancelEdit} disabled={editBusy}>Cancel</button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={en.id}>
                        <td>{en.year_start}{en.year_end ? `–${en.year_end}` : ''}</td>
                        <td>{en.title}</td>
                        <td>{en.description}</td>
                        {canWrite && (
                          <td>
                            <button className="mini" onClick={() => startEdit(en)}>Edit</button>{' '}
                            <button className="mini danger" onClick={() => removeEntry(en.id)}>Remove</button>
                          </td>
                        )}
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            )}

            {canWrite && (
              <form onSubmit={addEntry} className="inline-form" style={{ marginTop: 12 }}>
                <input type="number" placeholder="Start year" value={yearStart}
                  onChange={(e) => setYearStart(e.target.value)} style={{ width: 100 }} required />
                <input type="number" placeholder="End year (optional)" value={yearEnd}
                  onChange={(e) => setYearEnd(e.target.value)} style={{ width: 140 }} />
                <input type="text" placeholder="Code name/number, e.g. COVENIN 1756-1982" value={title}
                  onChange={(e) => setTitle(e.target.value)} required />
                <input type="text" placeholder="Description" value={description}
                  onChange={(e) => setDescription(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
                <button className="btn" type="submit" disabled={addBusy}>{addBusy ? 'Adding...' : 'Add'}</button>
              </form>
            )}

            {status && <p className={`status-line ${status.kind}`}>{status.msg}</p>}
          </>
        )}
      </div>
    </div>
  );
}

function CodesWorkspace({ reviewer, signOut }) {
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [canWrite, setCanWrite] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabaseLfe.from('country_codes').select('country').order('country', { ascending: true });
    setLoading(false);
    setCountries(data ?? []);
  }

  // Platform-wide, not scoped to a specific event - anyone holding a
  // triager/admin role on ANY event (which already includes every platform
  // admin, auto-membered onto every event) may edit; a pure viewer, or
  // someone with no event membership at all, gets the read-only view.
  async function checkWrite() {
    const { data: userData } = await supabaseLfe.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return;
    const { data } = await supabaseLfe.from('event_members')
      .select('role').eq('user_id', uid).in('role', ['admin', 'triager']).limit(1);
    setCanWrite((data ?? []).length > 0);
  }

  useEffect(() => { load(); checkWrite(); }, []);

  async function addCountry(name) {
    const { error } = await supabaseLfe.from('country_codes').insert({ country: name, updated_by: reviewer });
    if (!error) load();
    return !error;
  }

  return (
    <div className="triage-shell">
      <div className="tabs">
        <LfeNavGroup />
        <span className="tab-spacer" />
        <button className="signout" onClick={signOut}>Sign out</button>
      </div>
      <div className="tab-body">
        {loading ? <div className="container">Loading...</div> : (
          selected
            ? <CountryDetail country={selected} canWrite={canWrite} reviewer={reviewer} onBack={() => setSelected(null)} />
            : <CountryList countries={countries} onSelect={setSelected} onAdd={addCountry} canWrite={canWrite} />
        )}
      </div>
    </div>
  );
}

export default function CountryCodesLfe() {
  return (
    <LoginGateLfe>
      {({ signOut, reviewer }) => <CodesWorkspace reviewer={reviewer} signOut={signOut} />}
    </LoginGateLfe>
  );
}
