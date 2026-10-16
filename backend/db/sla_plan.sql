-- CNTMS / ตาราง Master สำหรับแผนนัดเข้ารับ (Sales Org) และ แผนนัดส่งกลับ (Return SLA)
-- รันใน Supabase SQL Editor

-- 1) เพิ่มคอลัมน์ใน rg_headers สำหรับเก็บแผนนัด
alter table rg_headers add column if not exists plan_pickup_date date;
alter table rg_headers add column if not exists plan_return_date date;

create index if not exists idx_rg_headers_plan_pickup on rg_headers(plan_pickup_date);
create index if not exists idx_rg_headers_plan_return on rg_headers(plan_return_date);

-- 2) ตาราง Master แผนนัดเข้ารับ (ผูกกับ Sales Org)
create table if not exists sla_pickup_rules (
  id              bigint generated always as identity primary key,
  sales_org       text not null unique,
  sales_org_name  text not null,
  days            integer,             -- จำนวนวัน (null = Key มือ)
  is_manual       boolean default false, -- true = Key มือ
  enabled         boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Seed ข้อมูลเริ่มต้น Sales Org
insert into sla_pickup_rules (sales_org, sales_org_name, days, is_manual)
values
  ('10', 'MT', null, true),
  ('11', 'TTD', 1, false),
  ('12', 'Van', 1, false),
  ('13', 'Export', 1, false),
  ('14', 'TTP', 1, false),
  ('15', 'e-Com.', 1, false),
  ('16', 'SPC', 1, false),
  ('17', 'Direct Sales', 1, false),
  ('30', 'Neo-F Sales Org.', 1, false)
on conflict (sales_org) do update
set sales_org_name = excluded.sales_org_name,
    days = excluded.days,
    is_manual = excluded.is_manual;

-- 3) ตาราง Master แผนนัดส่งกลับ (ผูกกับ Ship To / Sold To Code / เขต / จังหวัด)
create table if not exists sla_return_rules (
  id              bigint generated always as identity primary key,
  priority        integer not null default 100, -- 1: ship_to, 2: sold_to_code, 3: zone, 4: province
  rule_type       text not null,                -- 'ship_to' | 'sold_to_code' | 'zone' | 'province'
  match_value     text not null,                -- ค่าที่ต้องตรง (เช่น '011606', 'เขต 1', 'จ.เชียงใหม่')
  region          text,                         -- BKK, GBKK, North, Central, South, Northeast
  days            integer not null,             -- SLA จำนวนวัน
  note            text,                         -- หมายเหตุ เช่น 'เงื่อนไขพิเศษ', 'SLA ตามจังหวัด'
  enabled         boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_sla_return_rules_pri on sla_return_rules(priority);
create index if not exists idx_sla_return_rules_type on sla_return_rules(rule_type);

-- Seed ข้อมูล 77 จังหวัด จากไฟล์ แผนวันที่นัดกลับคืนคลัง.xlsx
insert into sla_return_rules (priority, rule_type, match_value, region, days, note)
values
  (4, 'province', 'กรุงเทพมหานคร', 'BKK', 3, 'BKK'),
  (4, 'province', 'นนทบุรี', 'GBKK', 3, 'GBKK'),
  (4, 'province', 'ปทุมธานี', 'GBKK', 3, 'GBKK'),
  (4, 'province', 'สมุทรปราการ', 'GBKK', 3, 'GBKK'),
  (4, 'province', 'จ.กระบี่', 'South', 30, 'South'),
  (4, 'province', 'จ.กาญจนบุรี', 'South', 30, 'South'),
  (4, 'province', 'จ.กาฬสินธุ์', 'Northeast', 30, 'Northeast'),
  (4, 'province', 'จ.กำแพงเพชร', 'North', 30, 'North'),
  (4, 'province', 'จ.ขอนแก่น', 'Northeast', 30, 'Northeast'),
  (4, 'province', 'จ.จันทบุรี', 'Central', 30, 'Central'),
  (4, 'province', 'จ.ฉะเชิงเทรา', 'Central', 30, 'Central'),
  (4, 'province', 'จ.ชลบุรี', 'Central', 30, 'Central'),
  (4, 'province', 'จ.ชัยนาท', 'North', 30, 'North'),
  (4, 'province', 'จ.ชัยภูมิ', 'Northeast', 30, 'Northeast'),
  (4, 'province', 'จ.ชุมพร', 'South', 30, 'South'),
  (4, 'province', 'จ.ตรัง', 'South', 30, 'South'),
  (4, 'province', 'จ.ตราด', 'Central', 30, 'Central'),
  (4, 'province', 'จ.ตาก', 'North', 30, 'North'),
  (4, 'province', 'จ.นครนายก', 'Central', 30, 'Central'),
  (4, 'province', 'จ.นครปฐม', 'Central', 30, 'Central'),
  (4, 'province', 'จ.นครพนม', 'Northeast', 30, 'Northeast'),
  (4, 'province', 'จ.นครราชสีมา', 'Northeast', 30, 'Northeast'),
  (4, 'province', 'จ.นครศรีธรรมราช', 'South', 30, 'South'),
  (4, 'province', 'จ.นครสวรรค์', 'North', 30, 'North'),
  (4, 'province', 'จ.นราธิวาส', '3 Provinces of lower south', 30, '3 Provinces of lower south'),
  (4, 'province', 'จ.น่าน', 'North', 30, 'North'),
  (4, 'province', 'จ.บึงกาฬ', 'Northeast', 30, 'Northeast'),
  (4, 'province', 'จ.บุรีรัมย์', 'Northeast', 30, 'Northeast'),
  (4, 'province', 'จ.ประจวบคีรีขันธ์', 'South', 30, 'South'),
  (4, 'province', 'จ.ปราจีนบุรี', 'Central', 30, 'Central'),
  (4, 'province', 'จ.ปัตตานี', '3 Provinces of lower south', 30, '3 Provinces of lower south'),
  (4, 'province', 'จ.พระนครศรีอยุธยา', 'Central', 30, 'Central'),
  (4, 'province', 'จ.พะเยา', 'North', 30, 'North'),
  (4, 'province', 'จ.พังงา', 'South', 30, 'South'),
  (4, 'province', 'จ.พัทลุง', 'South', 30, 'South'),
  (4, 'province', 'จ.พิจิตร', 'North', 30, 'North'),
  (4, 'province', 'จ.พิษณุโลก', 'North', 30, 'North'),
  (4, 'province', 'จ.ภูเก็ต', 'South', 30, 'South'),
  (4, 'province', 'จ.มหาสารคาม', 'Northeast', 30, 'Northeast'),
  (4, 'province', 'จ.มุกดาหาร', 'Northeast', 30, 'Northeast'),
  (4, 'province', 'จ.ยโสธร', 'Northeast', 30, 'Northeast'),
  (4, 'province', 'จ.ยะลา', '3 Provinces of lower south', 30, '3 Provinces of lower south'),
  (4, 'province', 'จ.ร้อยเอ็ด', 'Northeast', 30, 'Northeast'),
  (4, 'province', 'จ.ระนอง', 'South', 30, 'South'),
  (4, 'province', 'จ.ระยอง', 'Central', 30, 'Central'),
  (4, 'province', 'จ.ราชบุรี', 'South', 30, 'South'),
  (4, 'province', 'จ.ลพบุรี', 'Central', 30, 'Central'),
  (4, 'province', 'จ.ลำปาง', 'North', 30, 'North'),
  (4, 'province', 'จ.ลำพูน', 'North', 30, 'North'),
  (4, 'province', 'จ.ศรีสะเกษ', 'Northeast', 30, 'Northeast'),
  (4, 'province', 'จ.สกลนคร', 'Northeast', 30, 'Northeast'),
  (4, 'province', 'จ.สงขลา', 'South', 30, 'South'),
  (4, 'province', 'จ.สตูล', 'South', 30, 'South'),
  (4, 'province', 'จ.สมุทรสงคราม', 'South', 30, 'South'),
  (4, 'province', 'จ.สมุทรสาคร', 'Central', 30, 'Central'),
  (4, 'province', 'จ.สระแก้ว', 'Central', 30, 'Central'),
  (4, 'province', 'จ.สระบุรี', 'Central', 30, 'Central'),
  (4, 'province', 'จ.สิงห์บุรี', 'Central', 30, 'Central'),
  (4, 'province', 'จ.สุโขทัย', 'North', 30, 'North'),
  (4, 'province', 'จ.สุพรรณบุรี', 'South', 30, 'South'),
  (4, 'province', 'จ.สุราษฏร์ธานี', 'South', 30, 'South'),
  (4, 'province', 'จ.สุรินทร์', 'Northeast', 30, 'Northeast'),
  (4, 'province', 'จ.หนองคาย', 'Northeast', 30, 'Northeast'),
  (4, 'province', 'จ.หนองบัวลำภู', 'Northeast', 30, 'Northeast'),
  (4, 'province', 'จ.อ่างทอง', 'Central', 30, 'Central'),
  (4, 'province', 'จ.อำนาจเจริญ', 'Northeast', 30, 'Northeast'),
  (4, 'province', 'จ.อุดรธานี', 'Northeast', 30, 'Northeast'),
  (4, 'province', 'จ.อุตรดิตถ์', 'North', 30, 'North'),
  (4, 'province', 'จ.อุทัยธานี', 'North', 30, 'North'),
  (4, 'province', 'จ.อุบลราชธานี', 'Northeast', 30, 'Northeast'),
  (4, 'province', 'จ.เชียงราย', 'North', 30, 'North'),
  (4, 'province', 'จ.เชียงใหม่', 'North', 30, 'North'),
  (4, 'province', 'จ.เพชรบุรี', 'South', 30, 'South'),
  (4, 'province', 'จ.เพชรบูรณ์', 'North', 30, 'North'),
  (4, 'province', 'จ.เลย', 'Northeast', 30, 'Northeast'),
  (4, 'province', 'จ.แพร่', 'North', 30, 'North'),
  (4, 'province', 'จ.แม่ฮ่องสอน', 'North', 30, 'North')
on conflict do nothing;

-- 4) รีโหลด PostgREST schema cache
NOTIFY pgrst, 'reload schema';
