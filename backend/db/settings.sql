-- CNTMS — ตารางตั้งค่าระบบแบบ key-value (เก็บค่าที่ปรับได้จากหน้าเว็บ)
-- ใช้เก็บ "หมวดของ Vendor" (note_categories) ที่ Supervisor เพิ่ม/ลบเองได้
-- Run ใน Supabase SQL editor.

create table if not exists app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz default now()
);

-- ค่าเริ่มต้นของหมวด (ถ้ายังไม่มี) — ตรงกับที่เคย hardcode ไว้เดิม
insert into app_settings (key, value)
values ('note_categories', '["ยังไม่มี Route","ยังไม่ได้เอกสาร","อื่นๆ"]'::jsonb)
on conflict (key) do nothing;

-- เกณฑ์ KPI (วัน) แยก 3 ช่วง — เกินค่านี้ขึ้นสีแดง · Supervisor ปรับได้จากหน้าเว็บ
--   d1 = มอบหมาย→รับสินค้า · d2 = รับสินค้า→กลับคลัง · d3 = รับสินค้า→ปิดงาน
insert into app_settings (key, value)
values ('kpi_limits', '{"d1":3,"d2":3,"d3":3}'::jsonb)
on conflict (key) do nothing;

-- บังคับ PostgREST รีโหลด schema
NOTIFY pgrst, 'reload schema';
