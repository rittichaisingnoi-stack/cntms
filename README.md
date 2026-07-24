# CNTMS — ระบบจัดการคืนสินค้า RG (Return Goods) · WH08

ระบบ mobile-first สำหรับคลังสินค้า NEO เพื่อ **นำเข้ารายงาน RG จาก Excel**, **ค้นหา/ดูรายการคืนสินค้า** และ **พิมพ์เอกสาร PDF 2 แบบ** ต่อเลขที่ RG:

1. **ใบแจ้งให้ขนส่งไปรับคืนสินค้า** (FORM_WH)
2. **เอกสารแทนใบรับคืนสินค้า** (รายการสินค้า ดี / เสีย / รวม)

## Stack
- **Backend:** Node.js (Express, ESM) + Supabase (Postgres) + xlsx + PDFKit (ฟอนต์ Tahoma รองรับภาษาไทย)
- **Frontend:** HTML/CSS/JS static (mobile-first, ธีมน้ำเงิน/แดง NEO) เสิร์ฟผ่าน dev server พร้อม proxy `/api`

## ติดตั้งครั้งแรก
```bash
cd cntms
npm run install-all
```

## ตั้งค่าฐานข้อมูล (Supabase — project NEO_Edd)
1. คัดลอก `backend/.env.example` เป็น `backend/.env` แล้วใส่ `SUPABASE_URL` และ `SUPABASE_SERVICE_KEY`
2. รัน `backend/db/schema.sql` ใน Supabase SQL editor (สร้างตาราง `rg_headers`, `rg_items`)
3. รัน `backend/db/auth.sql` (สร้างตาราง `users`, `sessions`)
4. รัน `backend/db/orders.sql` (Order CN workflow: ขยาย `rg_headers`, ตาราง `vendors`, `order_tracking`, Storage bucket `cntms`)
5. รัน `backend/db/newflow.sql` (**Flow ใหม่ 3 บทบาท**: สถานะ returned, คอลัมน์ sold_to / assigned_at / returned_date / doc_wh / completed_date)

## สร้างผู้ใช้คนแรก (ต้องล็อกอินก่อนใช้งาน)
```bash
cd backend
node src/scripts/seedUser.js <username> <password> "ชื่อที่แสดง" admin
```
ทุก endpoint ภายใต้ `/api/rg` และ `/api/pdf` ต้องมี session token (ล็อกอินผ่านหน้าเว็บ) — token เก็บใน `localStorage` และแนบเป็น `Authorization: Bearer` (ลิงก์ PDF ใช้ `?token=`)

## รันตอนพัฒนา
```bash
npm run dev            # รันทั้ง backend (4700) + frontend (3700)
npm run dev:backend    # เฉพาะ backend
npm run dev:frontend   # เฉพาะ frontend
```
เปิด http://localhost:3700

## รันแบบ production
```bash
npm start              # backend เสิร์ฟทั้ง API + frontend ที่ http://localhost:4700
```

## การนำเข้าไฟล์
- **รายงานสรุป RG** (`All_RG.xlsx`, `RG Update.xlsx`, `<code> CJ.xlsx`) → เติมตาราง `rg_headers`
- **ReportRG-*.xlsx** (รายละเอียดสินค้า ดี/เสีย) → เติมตาราง `rg_items`

ระบบตรวจรูปแบบไฟล์อัตโนมัติจากหัวคอลัมน์ และ upsert ตามเลขที่ RG (นำเข้าซ้ำได้ ไม่เกิดข้อมูลซ้ำ)

## API
| Method | Path | รายละเอียด |
|---|---|---|
| GET  | `/api/health` | health check |
| POST | `/api/auth/login` | ล็อกอิน → `{ token, user }` |
| POST | `/api/auth/logout` | ออกจากระบบ (ล้าง session) |
| GET  | `/api/auth/me` | ตรวจสอบ session ปัจจุบัน |
| GET  | `/api/rg/reasons` | รายการรหัสเหตุผล |
| POST | `/api/rg/import` | อัปโหลด Excel (field `file`) |
| GET  | `/api/rg` | ค้นหา (`q, wh, reason, sold_to, from, to, page, pageSize`) |
| GET  | `/api/rg/:rgNo` | header + items ของ RG หนึ่งใบ |
| GET  | `/api/pdf/:rgNo/transport` | PDF ใบแจ้งขนส่ง |
| GET  | `/api/pdf/:rgNo/receipt` | PDF ใบรับคืนสินค้า |
| GET  | `/api/orders` | list ออเดอร์ (กรองตาม role/area/status อัตโนมัติ) |
| PUT  | `/api/orders/:rgNo/assign-vendor` | Admin TR มอบหมาย Vendor |
| PUT  | `/api/orders/:rgNo/vendor-receive` | Vendor คีย์วันที่รับ |
| PUT  | `/api/orders/:rgNo/assign-transport` | Vendor มอบหมายคนขับ |
| PUT  | `/api/orders/:rgNo/transport-confirm` | Transport ยืนยันรับ (+รูป optional) |
| POST | `/api/orders/:rgNo/complete` | GR อัปโหลดเอกสารจบงาน |
| PUT  | `/api/orders/:rgNo` | Supervisor แก้ไขทุก field |
| GET  | `/api/orders/:rgNo/tracking` | ประวัติสถานะ |
| GET/POST | `/api/admin/users`, `/api/admin/vendors` | Supervisor จัดการ user/vendor |
| GET  | `/api/dashboard/summary` · `/api/dashboard/export` | สรุปยอด · Export Excel |

## Roles & Workflow (Order CN)
`admin_tr → vendor → transport → gr → supervisor`. RG แต่ละใบ = 1 Order สถานะไหลจาก
`pending → assigned_vendor → assigned_transport → received → completed`.
แต่ละ role เห็นเฉพาะงานของตน (vendor/transport ตาม assign, admin_tr ตาม area), supervisor เห็น/แก้ได้ทุกอย่าง.

สร้าง user ทดสอบครบ 5 role: `node backend/src/scripts/seedDemo.js` (รหัสผ่านทุกคน `Neo@2026`; username: `admintr, vendor1, driver1, gr1, supervisor`).

หน้า **Transport** เป็น mobile-first + สแกน QR (ใช้ `BarcodeDetector` ของเบราว์เซอร์). QR ของเลขที่ RG สร้างด้วย `qrcode.js` (Kazuhiko Arase, MIT) แบบ offline.

## Reference & Area Priority Rules
- **Reference**: ระบบแยกเลขอ้างอิง (เช่น `4003536345`) จากคอลัมน์หมายเหตุอัตโนมัติตอน import → เก็บใน `rg_headers.reference`, แสดงเป็น chip ในการ์ด/รายละเอียด และออกในไฟล์ Export (คอลัมน์ Reference + Remark)
- **กติกาพื้นที่ (Priority Rules)**: Supervisor ตั้ง rule ได้ที่แท็บ "กติกาพื้นที่" — เลือก field (`Ship To, Sold To, Zone, จังหวัด, Sales Org, CN Type`), ค่า, และพื้นที่ปลายทาง เรียงตาม priority; order ที่นำเข้าจะถูกตั้ง `area` ตาม rule แรกที่ตรง และกดคำนวณย้อนหลังทั้งฐานได้ (`POST /api/admin/area-rules/apply`) — เปิด/ปิดแต่ละ rule ได้โดยไม่ต้องแก้โค้ด
