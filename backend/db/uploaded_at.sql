-- เพิ่มคอลัมน์วันที่นำเข้าไฟล์ (Upload) — รันใน Supabase SQL editor
alter table rg_headers add column if not exists uploaded_at timestamptz;
create index if not exists idx_rg_headers_uploaded_at on rg_headers(uploaded_at);

-- บังคับ PostgREST รีโหลด schema
NOTIFY pgrst, 'reload schema';
