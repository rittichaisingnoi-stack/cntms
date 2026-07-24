// สร้างผู้ใช้ตัวอย่าง 3 บทบาท (Supervisor / Vendor / GR) + vendor ตัวอย่าง สำหรับทดสอบ
// รัน: node src/scripts/seedDemo.js
import bcrypt from 'bcryptjs';
import { supabase } from '../lib/supabase.js';

const PASSWORD = 'Neo@2026';

const USERS = [
  { username: 'supervisor', role: 'supervisor', display_name: 'หัวหน้างาน' },
  { username: 'vendor1',    role: 'vendor',     display_name: 'Vendor ขนส่ง 1' },
  { username: 'gr1',        role: 'gr',         display_name: 'ทีมคลัง GR' },
];

const hash = await bcrypt.hash(PASSWORD, 10);

for (const u of USERS) {
  const { error } = await supabase.from('users').upsert(
    { ...u, password_hash: hash, is_active: true },
    { onConflict: 'username' }
  );
  console.log(error ? `✗ ${u.username}: ${error.message}` : `✓ ${u.username} (${u.role})`);
}

// vendor catalog row (สำหรับหน้า Manage Vendors ของ Supervisor)
const { error: ve } = await supabase.from('vendors').insert({ vendor_name: 'Vendor ขนส่ง 1', contact_info: '08x-xxx-xxxx' });
if (ve && ve.code !== '23505') console.log('vendor row:', ve.message);

console.log('\nรหัสผ่านทุกคน:', PASSWORD);
console.log('หมายเหตุ: order.vendor_id = users.id ของ user role=vendor; transport_id = users.id ของ role=transport');
process.exit(0);
