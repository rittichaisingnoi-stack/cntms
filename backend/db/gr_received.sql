-- เพิ่มสถานะ "รับสินค้าเข้าระบบ" (gr_received) สำหรับ flow ปิดงานของ GR
-- รันใน Supabase SQL editor หลังรัน newflow.sql แล้ว
--
-- flow ใหม่ตอน GR upload ไฟล์ปิดงาน:
--   แถวที่มี Remark  → status = gr_received (รับสินค้าเข้าระบบ) — ยังไม่ปิดงาน ต้องตามเคลียร์ Remark ก่อน
--   แถวที่ไม่มี Remark → status = completed  (ปิดงาน) เหมือนเดิม

-- 1) เก็บ Remark ที่ติดมากับไฟล์ปิดงาน (ใช้แสดงให้ GR ตามเคลียร์)
alter table rg_headers add column if not exists gr_remark text;

-- วันที่รับสินค้าเข้าระบบ (จาก Doc. WH) — แยกจาก completed_date
--   เพราะ KPI ช่วง 3 นับจาก completed_date ถ้าใบที่ยังติด Remark ไปประทับด้วยจะทำให้ KPI เพี้ยน
alter table rg_headers add column if not exists gr_received_date date;

-- 2) status_rank ใหม่ — แทรก gr_received ไว้ก่อน completed
--    (generated column แก้สูตรไม่ได้ ต้อง drop แล้วสร้างใหม่)
alter table rg_headers drop column if exists status_rank;
alter table rg_headers add column status_rank integer
  generated always as (
    case status
      when 'pending' then 1
      when 'assigned_vendor' then 2
      when 'received' then 3
      when 'returned' then 4
      when 'gr_received' then 5
      when 'completed' then 6
      else 9
    end
  ) stored;
create index if not exists idx_rg_headers_status_rank on rg_headers(status_rank);
