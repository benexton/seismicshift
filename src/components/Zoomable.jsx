import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { downloadFile } from '../lib/media.js';

/**
 * An image that opens full-size in a lightbox when clicked. The trigger click
 * cancels default and stops propagation, so using it inside a <label> never
 * toggles that label's checkbox, and the overlay renders in a portal on
 * document.body so it is fully outside any surrounding label. Click the backdrop
 * or press Escape to close.
 */
export default function Zoomable({ src, alt = '', className }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!src) return null;

  return (
    <>
      <img
        className={className}
        src={src}
        alt={alt}
        loading="lazy"
        style={{ cursor: 'zoom-in' }}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
      />
      {open && createPortal(
        <div className="lightbox" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); }}>
          <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
          <div className="lightbox-actions" onClick={(e) => e.stopPropagation()}>
            <button className="mini" onClick={(e) => { e.preventDefault(); e.stopPropagation(); downloadFile(src, alt); }}>Download</button>
            <button className="lightbox-close" aria-label="Close"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); }}>×</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
