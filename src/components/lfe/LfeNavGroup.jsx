// Shared top-bar nav links used identically on /lfe/, /lfe/admin/, and
// /lfe/public-preview/ - previously each page hand-rolled its own subset of
// these links, which drifted out of alignment with each other. Highlights
// whichever one matches the current page, the same way the tab buttons
// highlight the active tab.
//
// "Public view" deliberately points at /lfe/public-preview/, not the true
// public /lfe/public/ - this nav bar is only ever rendered for logged-in
// volunteers/admins, and /lfe/public-preview/ is the same content wrapped in
// this same bar so they keep a way back. The bare /lfe/public/ URL (what
// gets shared with the actual public) never renders this component at all.
const NAV_LINKS = [
  ['/lfe/', 'Your events'],
  ['/lfe/public-preview/', 'Public view'],
  ['/lfe/admin/', 'Admin'],
];

function normalize(p) {
  return p.endsWith('/') ? p : `${p}/`;
}

export default function LfeNavGroup() {
  const path = typeof window !== 'undefined' ? normalize(window.location.pathname) : '';
  return (
    <span className="navgroup">
      {NAV_LINKS.map(([href, label]) => (
        <a key={href} className={`navlink${path === href ? ' active' : ''}`} href={href}>{label}</a>
      ))}
    </span>
  );
}
