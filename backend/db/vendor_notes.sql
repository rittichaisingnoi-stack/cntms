-- CNTMS — ตารางบันทึกหมวด + เหตุผล ต่อออเดอร์ (Vendor คีย์ในหน้า "งานที่ได้รับมอบหมาย")
-- แต่ละ order มีได้หลายแถว (add/remove ได้) · เลือกหมวดจาก dropdown แล้วบังคับกรอกเหตุผล (free text)
-- Run ใน Supabase SQL editor.

create table if not exists rg_vendor_notes (
  id          bigint generated always as identity primary key,
  rg_no       text not null,                 -- join ไป rg_headers.rg_no
  category    text not null,                 -- ค่าจาก dropdown (หมวดที่กำหนดเอง)
  reason      text not null,                 -- เหตุผล (บังคับกรอกเมื่อเลือกหมวด)
  created_by  bigint,                        -- users.id ของ vendor ที่คีย์
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists idx_rg_vendor_notes_rg on rg_vendor_notes(rg_no);

-- บังคับ PostgREST รีโหลด schema (ไม่งั้น API อาจยังมองไม่เห็นตารางใหม่)
NOTIFY pgrst, 'reload schema';
