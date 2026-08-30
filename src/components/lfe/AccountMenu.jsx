import { useEffect, useRef, useState } from 'react';
import { supabaseLfe } from '../../lib/supabaseLfe.js';

// The account-related actions (edit display name, change password, sign
// out) used to be split across a fixed bottom-right "Change password"
// pill (unrelated to anything else on the page) and each page's own
// ad-hoc username/sign-out buttons in its topbar. Consolidated into one
// menu, anchored to the username in the top-right, so "Change password"
// is an option that appears beneath it on hover/click instead of a
// separate floating element that could end up overlapping other things.
// Dropdown mechanics (ref + click-outside + Escape) match LfeNavGroup.jsx.
export default function AccountMenu({ reviewer, signOut, updateName }) {
  const [open, setOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(reviewer);
  const [nameErr, setNameErr] = useState('');
  const [nameBusy, setNameBusy] = useState(false);
  const [showPwModal, setShowPwModal] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwDone, setPwDone] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); }
    function onKeyDown(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function openPasswordModal() {
    setOpen(false);
    setNewPw(''); setConfirmPw(''); setPwErr(''); setPwDone(false); setShowPwModal(true);
  }

  async function changePassword(e) {
    e.preventDefault();
    setPwErr('');
    if (newPw.length < 6) { setPwErr('Password must be at least 6 characters.'); return; }
    if (newPw !== confirmPw) { setPwErr('Passwords do not match.'); return; }
    setPwBusy(true);
    const { error } = await supabaseLfe.auth.updateUser({ password: newPw });
    setPwBusy(false);
    if (error) { setPwErr(error.message); return; }
    setPwDone(true);
  }

  function startEditName() {
    setNameDraft(reviewer);
    setNameErr('');
    setEditingName(true);
  }

  async function saveName() {
    if (nameBusy) return;
    const clean = nameDraft.trim();
    if (!clean) return;
    setNameBusy(true); setNameErr('');
    const { error } = await updateName(clean);
    setNameBusy(false);
    if (error) { setNameErr(error.message); return; }
    setEditingName(false);
    setOpen(false);
  }

  return (
    <>
      <span className="navgroup accountmenu" ref={rootRef}>
        <button
          type="button"
          className="accountmenu-btn"
          aria-haspopup="true"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {reviewer}
        </button>
        {open && (
          <div className="navmenu-drop accountmenu-drop" role="menu">
            {editingName ? (
              <div className="accountmenu-name-edit">
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveName(); }}
                    autoFocus
                    disabled={nameBusy}
                  />
                  <button type="button" className="mini" onClick={saveName} disabled={nameBusy}>
                    {nameBusy ? 'Saving...' : 'Save'}
                  </button>
                </div>
                {nameErr && <p className="err" style={{ margin: '6px 0 0', fontSize: 12 }}>{nameErr}</p>}
              </div>
            ) : (
              <button type="button" className="navmenu-item" role="menuitem" onClick={startEditName}>
                Edit display name
              </button>
            )}
            <button type="button" className="navmenu-item" role="menuitem" onClick={openPasswordModal}>
              Change password
            </button>
            <button type="button" className="navmenu-item" role="menuitem" onClick={() => { setOpen(false); signOut(); }}>
              Sign out
            </button>
          </div>
        )}
      </span>

      {showPwModal && (
        <div className="modal-backdrop" onClick={() => setShowPwModal(false)}>
          <div className="modal" style={{ width: 'min(360px, 100%)' }} onClick={(e) => e.stopPropagation()}>
            <div className="head">
              <h2>Change password</h2>
              <button type="button" className="x" onClick={() => setShowPwModal(false)}>&times;</button>
            </div>
            <div className="body" style={{ gridTemplateColumns: '1fr' }}>
              {pwDone ? (
                <p className="muted">Password updated.</p>
              ) : (
                <form onSubmit={changePassword}>
                  <div className="field">
                    <label htmlFor="new-pw">New password</label>
                    <input id="new-pw" type="password" autoComplete="new-password" value={newPw}
                      onChange={(e) => setNewPw(e.target.value)} required minLength={6} />
                  </div>
                  <div className="field">
                    <label htmlFor="confirm-pw">Confirm new password</label>
                    <input id="confirm-pw" type="password" autoComplete="new-password" value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)} required minLength={6} />
                  </div>
                  <button className="btn" type="submit" disabled={pwBusy}>{pwBusy ? 'Saving...' : 'Save password'}</button>
                  {pwErr && <p className="err">{pwErr}</p>}
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
