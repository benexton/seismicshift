import PublicViewLfe from './PublicViewLfe.jsx';
import LfeNavGroup from './LfeNavGroup.jsx';

// Same content as the true public page (PublicViewLfe), but wrapped in the
// internal tool's top bar. Logged-in volunteers/admins land here (not on
// /lfe/public/ itself) when they click "Public view" from within the app, so
// they keep a way back to Your events/Admin - the true public URL stays bare
// with no internal navigation exposed to anonymous visitors.
export default function PublicPreviewLfe() {
  return (
    <div className="triage-shell">
      <div className="tabs">
        <LfeNavGroup />
        <span className="tab-spacer" />
      </div>
      <div className="tab-body">
        <PublicViewLfe />
      </div>
    </div>
  );
}
