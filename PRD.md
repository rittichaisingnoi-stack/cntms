# Product Requirements Document (PRD): Order CN Management System

## 1. Overview (ภาพรวมของระบบ)
ระบบบริหารจัดการ Order CN เป็นระบบที่ใช้สำหรับติดตามสถานะและบริหารจัดการออเดอร์นำเข้าจากจีน (CN) ตั้งแต่การนำเข้าข้อมูลออเดอร์, การมอบหมายงานให้ Vendor, การรับงานของคนขับรถ (Transport) ไปจนถึงการรับสินค้าเข้าคลัง (GR) เพื่อให้ทุกฝ่ายสามารถทำงานร่วมกันได้อย่างราบรื่นและสามารถตรวจสอบสถานะได้แบบ Real-time ผ่าน Dashboard

## 2. Target Users & Roles (กลุ่มผู้ใช้งาน)
- **Admin TR**: ผู้นำเข้าข้อมูลออเดอร์เข้าสู่ระบบ, มอบหมายงานให้ Vendor และติดตามสถานะภาพรวม
- **Vendor**: บริษัทขนส่งหรือผู้รับเหมาช่วงที่รับงานจาก Admin TR, ทำหน้าที่คีย์รับสินค้าและส่งงานต่อให้คนขับรถ
- **Transport (คนขับรถ)**: ผู้ที่ไปรับ/ส่งสินค้าจริง ใช้งานผ่านมือถือเป็นหลักเพื่อสแกน QR Code ยืนยันการรับสินค้า
- **GR (Goods Receipt)**: ทีมคลังสินค้าที่คอยตรวจสอบและอัปโหลดเอกสารเมื่อออเดอร์เสร็จสิ้น
- **Supervisor**: หัวหน้างานที่สามารถจัดการ User, Vendor, ดูแลการ Assign Area และแก้ไขข้อมูลได้ทุกอย่าง พร้อมดูรายงานสรุปยอด

## 3. UI Design & Tone (การออกแบบและโทนของระบบ)
- **สไตล์**: ทันสมัย (Modern), ใช้งานง่ายสบายตา (Clean UI)
- **โทนสีหลัก**: สีน้ำเงิน (ความน่าเชื่อถือ, องค์ประกอบหลัก) + สีแดง (จุดที่ต้องการความสนใจ, ปุ่มยืนยัน/แจ้งเตือน)
- **แพลตฟอร์ม**: 
  - Web Application สำหรับ Admin TR, Vendor, GR, Supervisor
  - Mobile Web Application (Responsive) สำหรับ Transport

## 4. Database Schema (โครงสร้างฐานข้อมูลเบื้องต้น)

### `Users` Table
- `id` (PK)
- `username`
- `password` (Hashed)
- `role_id` (FK)
- `name`
- `area` (สำหรับ Admin TR)

### `Roles` Table
- `id` (PK)
- `role_name` (Admin TR, Vendor, Transport, GR, Supervisor)

### `Vendors` Table
- `id` (PK)
- `vendor_name`
- `contact_info`
- `created_at`

### `Orders` Table (อ้างอิงฟิลด์หลักจาก `All_RG.xlsx`)
- `id` (PK)
- `order_cn_no` (Unique)
- `details` (ข้อมูลสินค้า)
- `status` (Pending, Assigned to Vendor, Assigned to Transport, Received by Transport, Completed)
- `admin_id` (FK -> Users)
- `vendor_id` (FK -> Vendors)
- `transport_id` (FK -> Users)
- `received_date` (วันที่ Vendor คีย์รับ)
- `completed_file_url`
- `created_at`
- `updated_at`

### `Order_Tracking` Table (เก็บประวัติสถานะ)
- `id` (PK)
- `order_id` (FK -> Orders)
- `status`
- `action_by` (FK -> Users)
- `photo_url` (กรณี Transport ถ่ายรูป)
- `timestamp`

## 5. API Endpoints (สถาปัตยกรรม API)

### Authentication
- `POST /api/auth/login`: ล็อกอินเพื่อรับ Token (JWT)

### Orders Management
- `POST /api/orders/upload`: อัปโหลดไฟล์ Excel เพื่อ Import ออเดอร์ (ลบ Duplicate อัตโนมัติ)
- `GET /api/orders`: ดึงรายการออเดอร์ (รองรับ Filter ตาม Role และ Area)
- `PUT /api/orders/:id/assign-vendor`: Admin TR มอบหมายงานให้ Vendor
- `PUT /api/orders/:id/vendor-receive`: Vendor คีย์วันที่รับสินค้า
- `PUT /api/orders/:id/assign-transport`: Vendor มอบหมายงานให้คนขับรถ
- `PUT /api/orders/:id/transport-confirm`: Transport สแกน QR Code และแนบรูปภาพ (ถ้ามี) ยืนยัน
- `POST /api/orders/upload-complete`: GR อัปโหลดไฟล์จบงานออเดอร์
- `PUT /api/orders/:id`: Supervisor แก้ไขข้อมูลออเดอร์

### Users & Vendors Management (Supervisor Only)
- `POST /api/users`: สร้าง User ใหม่
- `POST /api/vendors`: สร้าง Vendor ใหม่
- `PUT /api/users/:id/area`: Assign Area ให้ Admin TR

### Dashboard & Reports
- `GET /api/dashboard/summary`: ดึงยอดสรุปรายวัน
- `GET /api/dashboard/export`: Export รายงานเป็น Excel/CSV

## 6. Business Logic (ลอจิกของระบบ)
- **Data Deduplication**: เมื่อ Admin TR อัปโหลดไฟล์ `All_RG.xlsx` ระบบจะต้องตรวจสอบคอลัมน์เลขที่ออเดอร์ (Order CN) หากมีอยู่ในระบบแล้วจะไม่นำเข้าซ้ำ หรือให้อัปเดตข้อมูลเก่า (Upsert)
- **Access Control**: 
  - Transport จะเห็นเฉพาะงานที่ Vendor จ่ายมาให้ตัวเองเท่านั้น
  - Vendor เห็นเฉพาะออเดอร์ที่ถูก Assign มาจาก Admin TR
  - Admin TR จัดการได้เฉพาะใน Area ที่ Supervisor มอบหมายให้
  - Supervisor มีสิทธิ (Super Admin) เข้าถึงและแก้ไขได้ทุก Record
- **QR Code Workflow**: หน้า Confirm ของ Transport ต้องใช้กล้องมือถือแสกน QR Code ซึ่งจะถอดรหัสเป็น `order_cn_no` และแสดงปุ่ม Confirm ทันที

## 7. Test Cases (กรณีทดสอบ)
1. **TC-001**: Admin TR อัปโหลดไฟล์ข้อมูลออเดอร์ที่มีข้อมูลซ้ำ ระบบจะต้องไม่สร้าง Record ซ้ำ
2. **TC-002**: Admin TR สามารถกด Assign Vendor ได้สำเร็จ และข้อมูลออเดอร์ปรากฏบน Dashboard ของ Vendor
3. **TC-003**: Vendor สามารถเลือกออเดอร์และ Assign ให้คนขับรถ (Transport) ได้
4. **TC-004**: Transport ล็อกอินผ่านมือถือ สามารถใช้ฟีเจอร์กล้องสแกน QR Code ได้
5. **TC-005**: Transport สแกน QR, กดข้ามการถ่ายรูป และกด Confirm สถานะออเดอร์ต้องเปลี่ยนเป็น Received
6. **TC-006**: GR สามารถอัปโหลดเอกสารสมบูรณ์ได้ และสถานะออเดอร์เปลี่ยนเป็น Completed
7. **TC-007**: Supervisor สามารถกด Export สรุปรายงานรายวันออกมาเป็นไฟล์ Excel ได้ครบถ้วน

## 8. Checklist ก่อนเริ่มพัฒนา
- [ ] สรุป Tech Stack ที่จะใช้ (เช่น Next.js + Node.js + PostgreSQL)
- [ ] ติดตั้งและตั้งค่า Git Repository
- [ ] สร้างโครงโปรเจค Frontend (พร้อมกำหนด Theme โทนสีน้ำเงิน/แดง ใน Tailwind)
- [ ] สร้างโครงโปรเจค Backend และกำหนดเชื่อมต่อ Database
- [ ] ตรวจสอบว่าไฟล์ `brand.md` และ `CLAUDE.md` นำไปใช้งานกับ AI Developer ได้ครบถ้วน
