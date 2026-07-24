import { Router } from 'express';
import { supabase } from '../lib/supabase.js';

// รายการสำหรับ dropdown — ผู้ใช้ที่ล็อกอินแล้วเรียกได้ (ข้อมูลไม่อ่อนไหว)
const router = Router();

// GET /api/lookup/vendors — บัญชีผู้ใช้ role=vendor (order.vendor_id = users.id)
router.get('/vendors', async (_req, res) => {
  const { data, error } = await supabase
    .from('users').select('id, display_name').eq('role', 'vendor').eq('is_active', true).order('display_name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// GET /api/lookup/drivers — คนขับรถ (role=transport) สำหรับ Vendor เลือก assign
router.get('/drivers', async (_req, res) => {
  const { data, error } = await supabase
    .from('users').select('id, display_name').eq('role', 'transport').eq('is_active', true).order('display_name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// หมวดเริ่มต้น (ใช้เมื่อยังไม่ได้รัน settings.sql หรือค่าว่าง)
export const DEFAULT_NOTE_CATEGORIES = ['สินค้าชำรุด', 'สินค้าหมดอายุ', 'ลด Stock', 'อื่นๆ'];

// GET /api/lookup/note-categories — หมวดของ Vendor (ทุก role ที่ล็อกอินอ่านได้)
router.get('/note-categories', async (_req, res) => {
  try {
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'note_categories').maybeSingle();
    const list = Array.isArray(data?.value) ? data.value.filter((x) => typeof x === 'string' && x.trim()) : null;
    res.json(list && list.length ? list : DEFAULT_NOTE_CATEGORIES);
  } catch {
    res.json(DEFAULT_NOTE_CATEGORIES); // ตารางยังไม่มี → ใช้ค่าเริ่มต้น
  }
});

// เกณฑ์ KPI เริ่มต้น (วัน) — ใช้เมื่อยังไม่ได้รัน settings.sql หรือค่าว่าง
export const DEFAULT_KPI_LIMITS = { d1: 3, d2: 3, d3: 3 };

// รับค่าดิบ → คืน { d1, d2, d3 } ที่เป็นจำนวนบวก (ไม่ครบ = ใช้ค่าเริ่มต้นรายช่อง)
export function normalizeKpiLimits(raw) {
  const out = { ...DEFAULT_KPI_LIMITS };
  if (raw && typeof raw === 'object') {
    for (const k of ['d1', 'd2', 'd3']) {
      const n = Number(raw[k]);
      if (Number.isFinite(n) && n > 0) out[k] = n;
    }
  }
  return out;
}

// GET /api/lookup/kpi-limits — เกณฑ์ KPI 3 ช่วง (ทุก role ที่ล็อกอินอ่านได้)
router.get('/kpi-limits', async (_req, res) => {
  try {
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'kpi_limits').maybeSingle();
    res.json(normalizeKpiLimits(data?.value));
  } catch {
    res.json(DEFAULT_KPI_LIMITS); // ตารางยังไม่มี → ใช้ค่าเริ่มต้น
  }
});

export default router;
