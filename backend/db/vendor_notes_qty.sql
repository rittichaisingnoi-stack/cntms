-- CNTMS — เพิ่ม "จำนวนที่รับคืน" + "หน่วย" ในตารางหมวด/เหตุผลของ Vendor
-- และผ่อนกติกา reason ให้ว่างได้ (บังคับกรอกเฉพาะหมวด "อื่นๆ" — เช็คที่ฝั่ง API)
-- Run ใน Supabase SQL editor.

alter table rg_vendor_notes add column if not exists return_qty numeric;   -- จำนวนที่รับคืน
alter table rg_vendor_notes add column if not exists unit       text;      -- หน่วย เช่น กล่อง/ชิ้น/ลัง

-- เหตุผลไม่บังคับแล้ว (เดิม not null) — หมวดอื่นที่ไม่ใช่ "อื่นๆ" ปล่อยว่างได้
alter table rg_vendor_notes alter column reason drop not null;

-- บังคับ PostgREST รีโหลด schema (ไม่งั้น API อาจยังมองไม่เห็นคอลัมน์ใหม่)
NOTIFY pgrst, 'reload schema';
