-- CNTMS / Flow ใหม่ (3 บทบาท: Supervisor / Vendor / GR) — รันใน Supabase SQL editor
-- ต่อจาก schema.sql + auth.sql + orders.sql
--
-- สถานะใหม่: pending (รอจัดพื้นที่) → assigned_vendor (มอบหมายแล้ว) →
--            received (รับสินค้าแล้ว) → returned (นำกลับคลังแล้ว) → completed (ปิดงาน)

-- 1) คอลัมน์ใหม่ใน rg_headers
alter table rg_headers add column if not exists sold_to        text;         -- รหัสลูกค้า (คอลัมน์ "Sold To" ท้ายรายงาน)
alter table rg_headers add column if not exists assigned_at    timestamptz;  -- เวลามอบหมาย Vendor (ใช้คำนวณ KPI)
alter table rg_headers add column if not exists returned_date  date;         -- วันนำสินค้ากลับคืนคลัง (Vendor กรอก)
alter table rg_headers add column if not exists doc_wh         text;         -- เลขที่ Doc. WH จาก ReportRG
alter table rg_headers add column if not exists completed_date date;         -- วันที่สร้าง Doc. WH = วันปิดงาน

create index if not exists idx_rg_headers_sold_to on rg_headers(sold_to);

-- 2) ย้ายสถานะเดิมเข้า workflow ใหม่ (ตัดบทบาทคนขับรถออก)
update rg_headers set status = 'assigned_vendor' where status = 'assigned_transport';

-- backfill เวลามอบหมายจากประวัติสถานะ
update rg_headers h
set assigned_at = t.created_at
from (
  select rg_no, min(created_at) as created_at
  from order_tracking where status = 'assigned_vendor' group by rg_no
) t
where h.rg_no = t.rg_no and h.assigned_at is null;

-- 3) status_rank ใหม่ (generated column แก้สูตรไม่ได้ ต้อง drop แล้วสร้างใหม่)
alter table rg_headers drop column if exists status_rank;
alter table rg_headers add column status_rank integer
  generated always as (
    case status
      when 'pending' then 1
      when 'assigned_vendor' then 2
      when 'received' then 3
      when 'returned' then 4
      when 'completed' then 5
      else 9
    end
  ) stored;
create index if not exists idx_rg_headers_status_rank on rg_headers(status_rank);

-- 4) กติกาจับคู่ Vendor: area ไม่บังคับแล้ว (rule ชี้ตรงไปที่ vendor)
alter table area_rules alter column area drop not null;

-- บังคับ PostgREST รีโหลด schema
NOTIFY pgrst, 'reload schema';
