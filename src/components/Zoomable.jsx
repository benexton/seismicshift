import { useEffect, useState } from 'react';

/**
 * An image that opens full-size in a lightbox overlay when clicked. Click the
 * overlay (or press Escape) to close. Used for photos and Street View
 * screenshots so reviewers can inspect detail.
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
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      />
      {open && (
        <div className="lightbox" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>
          <img src={src} alt={alt} />
          <button className="lightbox-close" aria-label="Close" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>×</button>
        </div>
      )}
    </>
  );
}
