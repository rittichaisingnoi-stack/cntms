-- CNTMS / Order CN workflow schema — Supabase Postgres (project NEO_Edd)
-- ต่อยอดจาก schema.sql (rg_headers/rg_items) + auth.sql (users/sessions)
-- รันใน Supabase SQL editor หลังรัน schema.sql และ auth.sql แล้ว

-- 1) ขยาย rg_headers ให้เป็น Order (RG 1 ใบ = 1 order ที่วิ่งผ่าน workflow)
alter table rg_headers add column if not exists status        text    default 'pending';
  -- pending | assigned_vendor | assigned_transport | received | completed
alter table rg_headers add column if not exists area          text;
alter table rg_headers add column if not exists admin_id      bigint;
alter table rg_headers add column if not exists vendor_id     bigint;
alter table rg_headers add column if not exists transport_id  bigint;
alter table rg_headers add column if not exists received_date date;
alter table rg_headers add column if not exists completed_file_url text;

create index if not exists idx_rg_headers_status    on rg_headers(status);
create index if not exists idx_rg_headers_area      on rg_headers(area);
create index if not exists idx_rg_headers_vendor    on rg_headers(vendor_id);
create index if not exists idx_rg_headers_transport on rg_headers(transport_id);

-- 2) ขยาย users ให้มี area (สำหรับ Admin TR) — role รองรับค่าใหม่ในโค้ด
alter table users add column if not exists area text;

-- 3) ตาราง vendors
create table if not exists vendors (
  id            bigint generated always as identity primary key,
  vendor_name   text not null,
  contact_info  text,
  is_active     boolean default true,
  created_at    timestamptz default now()
);

-- 4) ประวัติสถานะ order
create table if not exists order_tracking (
  id          bigint generated always as identity primary key,
  rg_no       text not null references rg_headers(rg_no) on delete cascade,
  status      text not null,
  action_by   bigint references users(id),
  photo_url   text,
  note        text,
  created_at  timestamptz default now()
);
create index if not exists idx_tracking_rg on order_tracking(rg_no);

-- 5) Reference — เลขอ้างอิงที่แยกจากคอลัมน์หมายเหตุ (เช่น "อ้างอิง 4003536345")
alter table rg_headers add column if not exists reference text;
create index if not exists idx_rg_headers_ref on rg_headers(reference);
-- backfill จากข้อมูลเดิม
update rg_headers
set reference = (regexp_match(reason_note, 'อ้างอิง\s*(\d{6,})'))[1]
where reference is null and reason_note ~ 'อ้างอิง\s*\d{6,}';

-- 6) กติกาจัดพื้นที่อัตโนมัติ (Priority Rules) — จับคู่ field ของ order → area
--    field: ship_to_code | sold_to_code | zone | province | sales_org | reason_code
create table if not exists area_rules (
  id           bigint generated always as identity primary key,
  priority     integer not null default 100,     -- น้อย = สำคัญกว่า
  rule_field   text    not null,
  match_value  text    not null,                 -- ค่าที่ต้องตรง (exact, case-insensitive)
  area         text    not null,                 -- พื้นที่ที่จะตั้งให้
  vendor_id    bigint,                           -- (optional) vendor default สำหรับ Admin TR ตอน assign
  enabled      boolean default true,
  created_at   timestamptz default now()
);
create index if not exists idx_area_rules_pri on area_rules(priority);

-- 6.1) status_rank — คอลัมน์คำนวณอัตโนมัติ ใช้เรียงตามลำดับ workflow
alter table rg_headers add column if not exists status_rank integer
  generated always as (
    case status
      when 'pending' then 1
      when 'assigned_vendor' then 2
      when 'assigned_transport' then 3
      when 'received' then 4
      when 'completed' then 5
      else 9
    end
  ) stored;
create index if not exists idx_rg_headers_status_rank on rg_headers(status_rank);

-- 6.2) วันที่มอบหมายคนขับ — แสดงในหน้างานที่ได้รับของ Transport
alter table rg_headers add column if not exists assigned_transport_at timestamptz;
-- backfill จากประวัติสถานะเดิม
update rg_headers h
set assigned_transport_at = t.created_at
from (
  select rg_no, max(created_at) as created_at
  from order_tracking where status = 'assigned_transport' group by rg_no
) t
where h.rg_no = t.rg_no and h.assigned_transport_at is null;

-- 7) Storage bucket สำหรับรูปถ่าย/เอกสารจบงาน (public read)
insert into storage.buckets (id, name, public)
values ('cntms', 'cntms', true)
on conflict (id) do nothing;

-- บังคับ PostgREST รีโหลด schema
NOTIFY pgrst, 'reload schema';
