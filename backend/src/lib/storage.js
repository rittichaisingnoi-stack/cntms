import { supabase } from './supabase.js';

const BUCKET = 'cntms';

// อัปโหลด buffer ไป Supabase Storage แล้วคืน public URL
// prefix เช่น 'photos' | 'complete'; ext มาจากชื่อไฟล์เดิม
export async function uploadFile(prefix, originalName, buffer, contentType) {
  const ext = (originalName?.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const key = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, buffer, { contentType: contentType || 'application/octet-stream', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
  return data.publicUrl;
}
