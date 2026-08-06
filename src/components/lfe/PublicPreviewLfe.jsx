import LoginGateLfe from './LoginGateLfe.jsx';
import PublicViewLfe from './PublicViewLfe.jsx';
import LfeNavGroup from './LfeNavGroup.jsx';

// Same content as the true public page (PublicViewLfe), but wrapped in the
// internal tool's top bar. Logged-in volunteers/admins land here (not on
// /lfe/public/ itself) when they click "Public view" from within the app, so
// they keep a way back to Your events/Admin - the true public URL stays bare
// with no internal navigation exposed to anonymous visitors.
//
// This page must sit behind the same login gate as every other internal
// page - it shows the internal top bar (which reveals the "Your events"/
// "Admin" nav structure), so anyone who guessed or was sent this URL could
// otherwise view it without ever signing in, which is exactly the
// unauthenticated exposure the true /lfe/public/ split was meant to prevent
// everywhere except that one deliberately public page.
export default function PublicPreviewLfe() {
  return (
    <LoginGateLfe>
      {() => (
        <div className="triage-shell">
          <div className="tabs">
            <LfeNavGroup />
            <span style={{ fontWeight: 600, alignSelf: 'center', marginRight: 6, color: '#cdd6e4' }}>Public view</span>
            <span className="tab-spacer" />
          </div>
          <div className="tab-body">
            <PublicViewLfe />
          </div>
        </div>
      )}
    </LoginGateLfe>
  );
}
