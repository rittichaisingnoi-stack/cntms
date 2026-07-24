// สร้าง/รีเซ็ตผู้ใช้: node src/scripts/seedUser.js <username> <password> [display_name] [role]
import bcrypt from 'bcryptjs';
import { supabase } from '../lib/supabase.js';

const [, , username, password, display_name, role = 'staff'] = process.argv;
if (!username || !password) {
  console.error('ใช้งาน: node src/scripts/seedUser.js <username> <password> [display_name] [role]');
  process.exit(1);
}

const password_hash = await bcrypt.hash(password, 10);
const { error } = await supabase
  .from('users')
  .upsert(
    { username, password_hash, display_name: display_name || username, role, is_active: true },
    { onConflict: 'username' }
  );

if (error) {
  console.error('ผิดพลาด:', error.message);
  process.exit(1);
}
console.log(`สร้าง/อัปเดตผู้ใช้ "${username}" (role=${role}) สำเร็จ`);
process.exit(0);
