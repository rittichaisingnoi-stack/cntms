// ล้างเฉพาะ "ข้อมูลออเดอร์/งาน" — เก็บ users และ sessions ไว้ (ไม่ต้อง login ใหม่)
// รัน: node src/scripts/clearData.js
// หมายเหตุ: ลบถาวร ย้อนกลับไม่ได้
import { supabase } from '../lib/supabase.js';

// เรียงตามลำดับ FK: ลบ child ก่อน parent
const TABLES = [
  'rg_vendor_notes', // หมวด+เหตุผลต่อออเดอร์
  'order_tracking',  // ประวัติสถานะ (อ้าง rg_headers)
  'rg_items',        // รายการสินค้า
  'rg_headers',      // ออเดอร์ RG
  'area_rules',      // กติกาจัดพื้นที่
  'vendors',         // รายชื่อ Vendor
];

console.log('เริ่มล้างข้อมูล (เก็บ users + sessions)...\n');
let hadError = false;
for (const t of TABLES) {
  // ก่อนลบ: นับจำนวนไว้แสดง
  const { count: before } = await supabase.from(t).select('*', { count: 'exact', head: true });
  // ลบทุกแถว: rg_headers/rg_items/rg_vendor_notes/order_tracking ใช้ rg_no; ที่เหลือใช้ id
  const useRg = ['rg_vendor_notes', 'order_tracking', 'rg_items', 'rg_headers'].includes(t);
  let del = supabase.from(t).delete();
  del = useRg ? del.not('rg_no', 'is', null) : del.gte('id', 0);
  const { error } = await del;
  if (error) { hadError = true; console.log(`  x ${t.padEnd(16)} : ${error.message}`); continue; }
  const { count: after } = await supabase.from(t).select('*', { count: 'exact', head: true });
  console.log(`  v ${t.padEnd(16)} : ${before ?? 0} -> ${after ?? 0} แถว`);
}

// ยืนยันว่า users/sessions ไม่ถูกแตะ
console.log('\nคงไว้ (ไม่ถูกลบ):');
for (const t of ['users', 'sessions']) {
  const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
  console.log(`  - ${t.padEnd(16)} : ${count ?? 0} แถว`);
}

console.log(hadError ? '\nเสร็จสิ้น (มีบางตารางผิดพลาด โปรดตรวจด้านบน)' : '\nเสร็จสิ้น — ระบบพร้อมนำเข้าข้อมูลใหม่');
process.exit(hadError ? 1 : 0);
