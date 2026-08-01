import { supabase, MEDIA_BUCKET } from './supabase.js';

// Upload an image to the media bucket and return its public URL.
export async function uploadImage(file, prefix = '') {
  const safe = file.name.replace(/[^\w.\-]/g, '_');
  const path = `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${safe}`;
  const up = await supabase.storage.from(MEDIA_BUCKET).upload(path, file);
  if (up.error) throw up.error;
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

// Upload any file (PDF, image, etc.) to the media bucket; returns its public URL.
export async function uploadFile(file, prefix = '') {
  return uploadImage(file, prefix);
}

// Force-download a file from a (possibly cross-origin) URL, preserving a name.
export async function downloadFile(url, filename) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const obj = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = obj;
    a.download = filename || url.split('/').pop().split('?')[0] || 'download';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(obj);
  } catch {
    // Fallback: open in a new tab if the blob fetch is blocked by CORS.
    window.open(url, '_blank', 'noopener');
  }
}
