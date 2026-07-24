// ล้างข้อมูลทั้งหมดเพื่อเริ่มทดสอบใหม่ (รวม users)
// รัน: node src/scripts/resetData.js
// หมายเหตุ: ลบถาวร ไม่สามารถย้อนกลับได้ — หลังรันควร seed ผู้ใช้ใหม่ (node src/scripts/seedDemo.js)
import { supabase } from '../lib/supabase.js';

// เรียงตามลำดับ FK: ลบตาราง child ก่อน parent
// order_tracking → rg_headers (on delete cascade), sessions → users (on delete cascade)
const TABLES = [
  'order_tracking',
  'rg_items',
  'rg_headers',
  'area_rules',
  'vendors',
  'sessions',
  'users',
];

for (const t of TABLES) {
  // ลบทุกแถว: ใช้เงื่อนไข id >= 0 (ทุกตารางมี id เป็น bigint identity) / token สำหรับ sessions
  const filter = t === 'sessions' ? { col: 'token', op: 'neq', val: '' } : { col: 'id', op: 'gte', val: 0 };
  let q = supabase.from(t).delete();
  q = filter.op === 'neq' ? q.neq(filter.col, filter.val) : q.gte(filter.col, filter.val);
  const { error } = await q;
  console.log(error ? `✗ ${t}: ${error.message}` : `✓ ล้าง ${t} แล้ว`);
}

console.log('\nเสร็จสิ้น — เริ่มทดสอบใหม่ได้เลย');
console.log('ถ้าต้องการผู้ใช้ตัวอย่าง: node src/scripts/seedDemo.js');
process.exit(0);
