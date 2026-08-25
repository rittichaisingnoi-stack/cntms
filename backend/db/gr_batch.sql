-- CNTMS / GR: ย้อนกลับการ upload ปิดงาน + ปิดงานเฉพาะใบที่วันที่ครบ
-- รันใน Supabase SQL editor (ต่อจาก newflow.sql + gr_received.sql)

-- 1) batch การ upload ปิดงานแต่ละครั้ง — ใช้ย้อนกลับทั้งชุด
create table if not exists gr_import_batches (
  id           bigint generated always as identity primary key,
  file_name    text,
  imported_by  bigint references users(id),
  completed    integer default 0,   -- จำนวนใบที่ปิดงานรอบนี้
  gr_received  integer default 0,   -- จำนวนใบที่เข้าสถานะ รับสินค้าเข้าระบบ
  pending      integer default 0,   -- จำนวนใบที่วันที่ยังไม่ครบ (ค้างรอ auto)
  reverted_at  timestamptz,         -- ย้อนกลับแล้วเมื่อไหร่ (null = ยังไม่ย้อน)
  reverted_by  bigint references users(id),
  created_at   timestamptz default now()
);

-- 2) สถานะเดิมของแต่ละ RG ก่อนถูก batch นั้นแก้ — เก็บไว้เพื่อ restore ตอนย้อนกลับ
create table if not exists gr_import_batch_items (
  id                bigint generated always as identity primary key,
  batch_id          bigint not null references gr_import_batches(id) on delete cascade,
  rg_no             text not null,
  prev_status       text,
  prev_doc_wh       text,
  prev_completed_date   date,
  prev_gr_received_date date,
  prev_gr_remark    text,
  created_at        timestamptz default now()
);
create index if not exists idx_gr_batch_items_batch on gr_import_batch_items(batch_id);
create index if not exists idx_gr_batch_items_rg    on gr_import_batch_items(rg_no);

-- 3) วันปิดงานที่ค้างรอ — ไฟล์มีวันปิดงานแล้ว แต่ received_date/returned_date ยังไม่ครบ
--    ระบบเก็บไว้ แล้ว auto-apply ทันทีที่ Vendor กรอกวันครบ (ไม่ต้อง upload ไฟล์ซ้ำ)
create table if not exists gr_pending_completions (
  rg_no          text primary key references rg_headers(rg_no) on delete cascade,
  doc_wh         text,
  completed_date date not null,
  remark         text,
  imported_by    bigint references users(id),
  batch_id       bigint references gr_import_batches(id) on delete set null,
  created_at     timestamptz default now()
);
