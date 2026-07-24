-- CNTMS / RG (Return Goods) schema — Supabase Postgres (project: NEO_Edd)
-- Run in the Supabase SQL editor.

create table if not exists rg_headers (
  id              bigint generated always as identity primary key,
  rg_no           text not null unique,          -- เลขที่ RG  e.g. 563-2026-00007
  zone            text,                           -- เขต
  sold_to_code    text,
  sold_to_name    text,                           -- ชื่อลูกค้า / ร้านค้า
  ship_to_code    text,
  ship_to_name    text,                           -- ที่อยู่ส่งของ (full address blob)
  qty_boxes       integer default 0,              -- จำนวนกล่อง
  qty_pieces      integer default 0,              -- จำนวนชิ้น
  reason_note     text,                           -- หมายเหตุ (WH + เหตุผล + freetext)
  wh_code         text,                           -- WH08
  reason_code     text,                           -- 05 / 06 / 15 ...
  reason_text     text,                           -- อายุ / สินค้าชำรุด/หมดคุณภาพ ...
  rg_date         date,                           -- วันที่คีย์
  sales_org       text,
  contact_name    text,                           -- ติดต่อคุณ (สำหรับใบขนส่ง)
  contact_phone   text,
  sales_person    text,                           -- พนักงานขาย
  province        text,                           -- จังหวัด
  district        text,                           -- อำเภอ
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table if not exists rg_items (
  id            bigint generated always as identity primary key,
  rg_no         text not null,   -- join key ไป rg_headers.rg_no (ไม่ผูก FK: รายงาน 2 ชุดนำเข้าอิสระ ลำดับใดก่อนก็ได้)
  line_no       integer,
  product_code  text,                             -- รหัสสินค้า
  product_name  text,                             -- ชื่อสินค้า
  qty_good      integer default 0,                -- ดี (ชิ้น)
  qty_damaged   integer default 0,                -- เสีย (ชิ้น)
  invoice_no    text,
  created_at    timestamptz default now()
);

create index if not exists idx_rg_headers_date   on rg_headers(rg_date);
create index if not exists idx_rg_headers_wh     on rg_headers(wh_code);
create index if not exists idx_rg_headers_reason on rg_headers(reason_code);
create index if not exists idx_rg_headers_sold   on rg_headers(sold_to_code);
create index if not exists idx_rg_items_rg       on rg_items(rg_no);
