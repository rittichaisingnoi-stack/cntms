import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { supabase } from '../lib/supabase.js';
import { createSession, destroySession, requireAuth } from '../lib/auth.js';

const router = Router();

// POST /api/auth/login — { username, password } -> { token, user }
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });

  const { data: user } = await supabase
    .from('users')
    .select('id, username, display_name, role, area, is_active, password_hash')
    .eq('username', username)
    .maybeSingle();

  // เทียบ hash เสมอเพื่อลด timing leak ระหว่างมี/ไม่มี user
  const hash = user?.password_hash || '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva';
  const ok = await bcrypt.compare(password, hash);
  if (!user || !ok) return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  if (!user.is_active) return res.status(403).json({ error: 'บัญชีถูกระงับ' });

  const token = await createSession(user.id);
  res.json({
    token,
    user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role, area: user.area },
  });
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req, res) => {
  await destroySession(req.token);
  res.json({ ok: true });
});

// GET /api/auth/me — ตรวจสอบเซสชันปัจจุบัน
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// PUT /api/auth/password — เปลี่ยนรหัสผ่านของตัวเอง (ทุก role)
router.put('/password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password)
    return res.status(400).json({ error: 'กรุณากรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่' });
  if (String(new_password).length < 6)
    return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });

  const { data: user } = await supabase
    .from('users').select('id, password_hash').eq('id', req.user.id).maybeSingle();
  if (!user) return res.status(404).json({ error: 'ไม่พบบัญชีผู้ใช้' });

  const ok = await bcrypt.compare(current_password, user.password_hash || '');
  if (!ok) return res.status(401).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });

  const password_hash = await bcrypt.hash(String(new_password), 10);
  const { error } = await supabase.from('users').update({ password_hash }).eq('id', user.id);
  if (error) return res.status(500).json({ error: 'บันทึกรหัสผ่านไม่สำเร็จ' });

  res.json({ ok: true });
});

export default router;
