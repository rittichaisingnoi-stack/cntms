import crypto from 'node:crypto';
import { supabase } from './supabase.js';

const SESSION_DAYS = 7;

export function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function createSession(userId) {
  const token = newToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  const { error } = await supabase.from('sessions').insert({ token, user_id: userId, expires_at: expires });
  if (error) throw error;
  return token;
}

export async function destroySession(token) {
  await supabase.from('sessions').delete().eq('token', token);
}

// Express middleware — ต้องส่ง Authorization: Bearer <token>
export async function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  // Bearer header เป็นหลัก; รองรับ ?token= สำหรับลิงก์เปิดไฟล์ PDF ในแท็บใหม่ (ส่ง header ไม่ได้)
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : (req.query.token || null);
  if (!token) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });

  const { data: sess } = await supabase
    .from('sessions').select('user_id, expires_at').eq('token', token).maybeSingle();
  if (!sess) return res.status(401).json({ error: 'เซสชันไม่ถูกต้อง' });
  if (new Date(sess.expires_at) < new Date()) {
    await destroySession(token);
    return res.status(401).json({ error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
  }
  const { data: user } = await supabase
    .from('users').select('id, username, display_name, role, area, is_active').eq('id', sess.user_id).maybeSingle();
  if (!user || !user.is_active) return res.status(401).json({ error: 'บัญชีถูกระงับ' });

  req.user = user;
  req.token = token;
  next();
}

// ใช้ต่อจาก requireAuth — จำกัดเฉพาะบาง role (supervisor เข้าถึงได้ทุกอย่าง)
export function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (role === 'supervisor' || roles.includes(role)) return next();
    res.status(403).json({ error: 'ไม่มีสิทธิ์ใช้งานส่วนนี้' });
  };
}
