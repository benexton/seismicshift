import { supabase, MEDIA_BUCKET } from './supabase.js';

// Upload an image to the media bucket and return its public URL.
export async function uploadImage(file, prefix = '') {
  const safe = file.name.replace(/[^\w.\-]/g, '_');
  const path = `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${safe}`;
  const up = await supabase.storage.from(MEDIA_BUCKET).upload(path, file);
  if (up.error) throw up.error;
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}
