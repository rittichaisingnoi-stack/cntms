import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { supabase } from '../lib/supabase.js';
import { requireRole } from '../lib/auth.js';
import { RULE_FIELDS, autoAssignPending } from '../lib/areaRules.js';

const router = Router();

// ทั้งหมดเฉพาะ Supervisor (requireRole อนุญาต supervisor เสมอ)
router.use(requireRole('supervisor'));

const ROLES = ['vendor', 'gr', 'supervisor', 'admin'];

// ---- Users ----
router.get('/users', async (_req, res) => {
  const { data, error } = await supabase
    .from('users').select('id, username, display_name, role, area, is_active, created_at')
    .order('id');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

router.post('/users', async (req, res) => {
  const { username, password, display_name, role, area } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'ต้องมี username และ password' });
  if (role && !ROLES.includes(role)) return res.status(400).json({ error: 'role ไม่ถูกต้อง' });
  const password_hash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase
    .from('users')
    .insert({ username, password_hash, display_name: display_name || username, role: role || 'vendor', area: area || null })
    .select('id, username, display_name, role, area')
    .single();
  if (error) return res.status(error.code === '23505' ? 409 : 500).json({ error: error.message });
  res.json(data);
});

// PUT /api/admin/users/:id/area — Assign Area ให้ Admin TR
router.put('/users/:id/area', async (req, res) => {
  const { area } = req.body || {};
  const { error } = await supabase.from('users').update({ area: area || null }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// PUT /api/admin/users/:id — แก้ role/active/reset password
router.put('/users/:id', async (req, res) => {
  const { role, is_active, password, display_name } = req.body || {};
  const patch = {};
  if (role) { if (!ROLES.includes(role)) return res.status(400).json({ error: 'role ไม่ถูกต้อง' }); patch.role = role; }
  if (typeof is_active === 'boolean') patch.is_active = is_active;
  if (display_name) patch.display_name = display_name;
  if (password) patch.password_hash = await bcrypt.hash(password, 10);
  const { error } = await supabase.from('users').update(patch).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// DELETE /api/admin/users/:id — ลบผู้ใช้ (Supervisor เท่านั้น)
router.delete('/users/:id', async (req, res) => {
  if (String(req.user.id) === String(req.params.id)) {
    return res.status(400).json({ error: 'ไม่สามารถลบบัญชีของตัวเองได้' });
  }
  const { error } = await supabase.from('users').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ---- Vendors ----
router.get('/vendors', async (_req, res) => {
  const { data, error } = await supabase.from('vendors').select('*').order('id');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

router.post('/vendors', async (req, res) => {
  const { vendor_name, contact_info } = req.body || {};
  if (!vendor_name) return res.status(400).json({ error: 'ต้องมีชื่อ Vendor' });
  const { data, error } = await supabase
    .from('vendors').insert({ vendor_name, contact_info: contact_info || null }).select('*').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PUT /api/admin/vendors/:id — แก้ไข vendor
router.put('/vendors/:id', async (req, res) => {
  const patch = {};
  for (const k of ['vendor_name', 'contact_info', 'is_active']) {
    if (k in (req.body || {})) patch[k] = req.body[k];
  }
  const { error } = await supabase.from('vendors').update(patch).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ---- Area Priority Rules ----
router.get('/area-rules/fields', (_req, res) => {
  res.json(Object.entries(RULE_FIELDS).map(([key, label]) => ({ key, label })));
});

router.get('/area-rules', async (_req, res) => {
  const { data, error } = await supabase.from('area_rules').select('*').order('priority').order('id');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

router.post('/area-rules', async (req, res) => {
  const { priority, rule_field, match_value, area, vendor_id, enabled } = req.body || {};
  if (!RULE_FIELDS[rule_field]) return res.status(400).json({ error: 'rule_field ไม่ถูกต้อง' });
  if (!match_value) return res.status(400).json({ error: 'ต้องมีค่าที่ต้องตรง (match_value)' });
  if (!vendor_id) return res.status(400).json({ error: 'ต้องเลือก Vendor' });
  const { data, error } = await supabase.from('area_rules')
    .insert({ priority: Number(priority) || 100, rule_field, match_value, area: area || null, vendor_id, enabled: enabled !== false })
    .select('*').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.put('/area-rules/:id', async (req, res) => {
  const patch = {};
  for (const k of ['priority', 'rule_field', 'match_value', 'area', 'vendor_id', 'enabled']) {
    if (k in (req.body || {})) patch[k] = req.body[k];
  }
  if (patch.rule_field && !RULE_FIELDS[patch.rule_field]) return res.status(400).json({ error: 'rule_field ไม่ถูกต้อง' });
  const { error } = await supabase.from('area_rules').update(patch).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

router.delete('/area-rules/:id', async (req, res) => {
  const { error } = await supabase.from('area_rules').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// POST /api/admin/area-rules/apply — Re-assign: จับคู่ Vendor ให้ order pending ทั้งหมดตามกติกาปัจจุบัน
router.post('/area-rules/apply', async (req, res) => {
  try {
    const r = await autoAssignPending({ actionBy: req.user.id });
    res.json({ assigned: r.assigned, waiting: r.waiting, new_shops: r.newShops });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- หมวดของ Vendor (note_categories) — Supervisor เพิ่ม/ลบเองได้ ----
import { DEFAULT_NOTE_CATEGORIES } from './lookup.js';

// GET /api/admin/note-categories — อ่านรายการปัจจุบัน
router.get('/note-categories', async (_req, res) => {
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'note_categories').maybeSingle();
  const list = Array.isArray(data?.value) ? data.value : null;
  res.json(list && list.length ? list : DEFAULT_NOTE_CATEGORIES);
});

// PUT /api/admin/note-categories — บันทึกรายการใหม่ทั้งชุด { categories: [...] }
router.put('/note-categories', async (req, res) => {
  const raw = req.body?.categories;
  if (!Array.isArray(raw)) return res.status(400).json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' });
  // ทำความสะอาด: ตัดช่องว่าง, ตัดค่าซ้ำ, ตัดค่าว่าง
  const seen = new Set();
  const categories = [];
  for (const c of raw) {
    const v = String(c ?? '').trim();
    if (!v || seen.has(v)) continue;
    seen.add(v); categories.push(v);
  }
  if (!categories.length) return res.status(400).json({ error: 'ต้องมีอย่างน้อย 1 หมวด' });
  const { error } = await supabase.from('app_settings')
    .upsert({ key: 'note_categories', value: categories, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, categories });
});

// ---- เกณฑ์ KPI (kpi_limits) — Supervisor ปรับ threshold 3 ช่วงได้ ----
import { DEFAULT_KPI_LIMITS, normalizeKpiLimits } from './lookup.js';

// GET /api/admin/kpi-limits — อ่านเกณฑ์ปัจจุบัน
router.get('/kpi-limits', async (_req, res) => {
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'kpi_limits').maybeSingle();
  res.json(normalizeKpiLimits(data?.value));
});

// PUT /api/admin/kpi-limits — บันทึกเกณฑ์ใหม่ { d1, d2, d3 } (จำนวนบวก)
router.put('/kpi-limits', async (req, res) => {
  const b = req.body || {};
  const limits = {};
  for (const k of ['d1', 'd2', 'd3']) {
    const n = Number(b[k]);
    if (!Number.isFinite(n) || n <= 0) return res.status(400).json({ error: `ค่า ${k} ต้องเป็นจำนวนวันที่มากกว่า 0` });
    limits[k] = n;
  }
  const { error } = await supabase.from('app_settings')
    .upsert({ key: 'kpi_limits', value: limits, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, ...limits });
});

export default router;
