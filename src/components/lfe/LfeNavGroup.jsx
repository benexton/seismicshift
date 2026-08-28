import { useEffect, useRef, useState } from 'react';

// Shared top-bar nav used identically on every LFE page (the events list,
// the per-event workspace, admin, codes & standards, and the logged-in
// public preview) - previously each page hand-rolled its own subset of these
// links, which drifted out of alignment with each other. Collapsed into a
// single menu button rather than four separate buttons so the header has
// room to breathe on narrower screens; the dropdown highlights whichever
// link matches the current page, the same way the tab buttons highlight the
// active tab.
//
// "Public view" deliberately points at /erp/public-preview/, not the true
// public /erp/public/ - this nav bar is only ever rendered for logged-in
// volunteers/admins, and /erp/public-preview/ is the same content wrapped in
// this same bar so they keep a way back. The bare /erp/public/ URL (what
// gets shared with the actual public) never renders this component at all.
const NAV_LINKS = [
  ['/erp/', 'Your events'],
  ['/erp/codes/', 'Codes & standards'],
  ['/erp/public-preview/', 'Public view'],
  ['/erp/admin/', 'Admin'],
];

function normalize(p) {
  return p.endsWith('/') ? p : `${p}/`;
}

export default function LfeNavGroup() {
  const path = typeof window !== 'undefined' ? normalize(window.location.pathname) : '';
  const [open, setOpen] = useState(false);
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

  return (
    <span className="navgroup" ref={rootRef}>
      <button
        type="button"
        className="navmenu-btn"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Menu"
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <rect y="2" width="16" height="2" rx="1" fill="currentColor" />
          <rect y="7" width="16" height="2" rx="1" fill="currentColor" />
          <rect y="12" width="16" height="2" rx="1" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div className="navmenu-drop" role="menu">
          {NAV_LINKS.map(([href, label]) => (
            <a key={href} className={`navmenu-item${path === href ? ' active' : ''}`} href={href} role="menuitem">
              {label}
            </a>
          ))}
        </div>
      )}
    </span>
  );
}
