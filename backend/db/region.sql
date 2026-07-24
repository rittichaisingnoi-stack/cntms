-- CNTMS — เพิ่มคอลัมน์ Region (ภูมิภาค) ในหัวออเดอร์
-- อ่านจากคอลัมน์ "Region" ในไฟล์รายงาน RG (เช่น BANGKOK / CENTRAL / SOUTH)
-- Run ใน Supabase SQL editor.

alter table rg_headers add column if not exists region text;

-- บังคับ PostgREST รีโหลด schema
NOTIFY pgrst, 'reload schema';
