import { Router } from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import { supabase } from '../lib/supabase.js';
import { parseWorkbook } from '../lib/importExcel.js';
import { REASON_MAP } from '../lib/reasons.js';
import { autoAssignPending } from '../lib/areaRules.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// GET /api/rg/reasons — reason code lookup for filters
router.get('/reasons', (_req, res) => {
  res.json(Object.entries(REASON_MAP).map(([code, text]) => ({ code, text })));
});

// POST /api/rg/debug-columns — ตรวจว่าไฟล์จริงมีหัวตารางอะไร และคอลัมน์ L มีค่าอะไร
//   ใช้ไล่ปัญหา mapping คอลัมน์ (ไม่บันทึกอะไรลง DB)
router.post('/debug-columns', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ไม่พบไฟล์' });
  try {
    const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
    const hi = rows.findIndex((r) => r.some((c) => /Sold To Code/i.test(String(c ?? ''))));
    const colLetter = (i) => String.fromCharCode(65 + i);
    res.json({
      sheet: wb.SheetNames[0],
      header_row_index: hi,
      headers: hi < 0 ? null : rows[hi].map((c, i) => ({ col: colLetter(i), idx: i, label: String(c ?? '') })),
      sample_rows: rows.slice(hi + 1, hi + 4).map((r) => r.map((c, i) => ({ col: colLetter(i), value: c }))),
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/rg/parse — อ่านไฟล์แล้วส่งข้อมูลกลับให้ preview/แก้ไข "โดยยังไม่บันทึก"
router.post('/parse', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ไม่พบไฟล์ (field name ต้องเป็น "file")' });
  try {
    const parsed = parseWorkbook(req.file.buffer);
    res.json({ format: parsed.format, headers: parsed.headers, items: parsed.items });
  } catch (e) {
    res.status(400).json({ error: 'อ่านไฟล์ Excel ไม่ได้: ' + e.message });
  }
});

// ฟิลด์ header ที่อนุญาตให้บันทึก (กันไม่ให้ยัด field แปลกปลอมจากฝั่ง client)
const HEADER_FIELDS = [
  'rg_no', 'zone', 'sold_to_code', 'sold_to', 'sold_to_name', 'ship_to_code', 'ship_to_name',
  'qty_boxes', 'qty_pieces', 'reason_note', 'wh_code', 'reason_code', 'reason_text', 'reference',
  'rg_date', 'sales_org', 'district', 'province', 'region',
];
const RG_RE = /^\d{3}-\d{4}-\d{4,}$/;
const cleanHeader = (h) => {
  const o = {};
  for (const k of HEADER_FIELDS) if (k in h) o[k] = h[k];
  o.qty_boxes = Number(o.qty_boxes) || 0;
  o.qty_pieces = Number(o.qty_pieces) || 0;
  return o;
};

// POST /api/rg/import — บันทึกรายงาน RG
//   โหมด A: แนบไฟล์ (parse+save ในขั้นตอนเดียว เหมือนเดิม)
//   โหมด B: ส่ง JSON { headers:[...] } ที่ผู้ใช้แก้ไขจากหน้า preview แล้ว
router.post('/import', upload.single('file'), async (req, res) => {
  let parsed;
  if (req.file) {
    try {
      parsed = parseWorkbook(req.file.buffer);
    } catch (e) {
      return res.status(400).json({ error: 'อ่านไฟล์ Excel ไม่ได้: ' + e.message });
    }
  } else if (Array.isArray(req.body?.headers)) {
    // โหมดแก้ไขจากฟอร์ม — รับเฉพาะ headers ที่ผ่าน validate
    const bad = [];
    const headers = [];
    for (const h of req.body.headers) {
      const rg = String(h?.rg_no ?? '').trim();
      if (!RG_RE.test(rg)) { bad.push(rg || '(ว่าง)'); continue; }
      headers.push({ ...cleanHeader(h), rg_no: rg });
    }
    if (!headers.length) return res.status(400).json({ error: 'ไม่มีแถวที่เลขที่ RG ถูกต้อง' + (bad.length ? ` (ผิดรูปแบบ ${bad.length} แถว)` : '') });
    parsed = { format: req.body.format || 'summary', headers, items: [] };
  } else {
    return res.status(400).json({ error: 'ต้องแนบไฟล์ หรือส่งข้อมูล headers ที่แก้ไขแล้ว' });
  }

  try {
    // ถ้ายังไม่ได้รัน region.sql (column region ยังไม่มี) → ตัด region ออกกัน upsert พัง
    const hasRegion = !(await supabase.from('rg_headers').select('region').limit(1)).error;

    let headers = 0, items = 0, autoAssigned = 0, waiting = 0, newShops = [];
    if (parsed.headers.length) {
      // ไฟล์เดียวอาจมีเลขที่ RG ซ้ำ — เก็บแถวหลังสุดของแต่ละ rg_no (upsert ห้ามชนกันเองในชุดเดียว)
      const uploadedAt = new Date().toISOString();
      const dedup = [...new Map(parsed.headers.map((h) => [h.rg_no, h])).values()]
        .map((h) => { const o = { ...h, uploaded_at: uploadedAt }; if (!hasRegion) delete o.region; return o; });
      const { error } = await supabase
        .from('rg_headers')
        .upsert(dedup, { onConflict: 'rg_no' });
      if (error) throw error;
      headers = dedup.length;

      // Auto-assign Vendor ตามกติกา (Ship To Code → Sold To → Sold To Code → เขต)
      // เฉพาะ order ที่ยัง pending — ไม่แตะงานที่เดิน workflow ไปแล้ว
      try {
        const r = await autoAssignPending({ rgNos: dedup.map((h) => h.rg_no), actionBy: req.user?.id });
        autoAssigned = r.assigned; waiting = r.waiting; newShops = r.newShops;
      } catch { /* ตาราง rules ยังไม่มี → ข้าม */ }
    }
    if (parsed.items.length) {
      const rgNos = [...new Set(parsed.items.map((i) => i.rg_no))];
      // FK: rg_items.rg_no -> rg_headers.rg_no — รายงาน detail อาจมี RG ที่ยังไม่มี header
      // สร้าง header stub (ไม่ทับของเดิม) ให้ครบก่อน เพื่อไม่ให้ FK พัง
      const stubs = rgNos.map((rg_no) => ({ rg_no }));
      const { error: e0 } = await supabase
        .from('rg_headers')
        .upsert(stubs, { onConflict: 'rg_no', ignoreDuplicates: true });
      if (e0) throw e0;
      await supabase.from('rg_items').delete().in('rg_no', rgNos);
      const { error } = await supabase.from('rg_items').insert(parsed.items);
      if (error) throw error;
      items = parsed.items.length;
    }
    res.json({
      format: parsed.format, imported: { headers, items },
      auto_assigned: autoAssigned, waiting_assignment: waiting,
      new_shops: newShops, // ร้านที่ไม่ตรงกติกาใดเลย — แจ้งเตือนให้ไปเพิ่มกติกา
    });
  } catch (e) {
    res.status(500).json({ error: 'บันทึกลงฐานข้อมูลไม่สำเร็จ: ' + e.message });
  }
});

// GET /api/rg — list/search with filters
// q, wh, reason, sold_to, from, to, page, pageSize
router.get('/', async (req, res) => {
  const { q, wh, reason, sold_to, from, to } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));

  let query = supabase.from('rg_headers').select('*', { count: 'exact' });
  if (wh) query = query.eq('wh_code', wh);
  if (reason) query = query.eq('reason_code', reason);
  if (sold_to) query = query.eq('sold_to_code', sold_to);
  if (from) query = query.gte('rg_date', from);
  if (to) query = query.lte('rg_date', to);
  if (q) query = query.or(`rg_no.ilike.%${q}%,sold_to_name.ilike.%${q}%,ship_to_name.ilike.%${q}%`);
  query = query.order('rg_date', { ascending: false }).order('rg_no', { ascending: false });
  query = query.range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data, page, pageSize, total: count ?? 0 });
});

// GET /api/rg/:rgNo — one RG header + items
router.get('/:rgNo', async (req, res) => {
  const rgNo = req.params.rgNo;
  const { data: header, error: e1 } = await supabase
    .from('rg_headers').select('*').eq('rg_no', rgNo).maybeSingle();
  if (e1) return res.status(500).json({ error: e1.message });
  if (!header) return res.status(404).json({ error: 'ไม่พบเลขที่ RG นี้' });
  const { data: items, error: e2 } = await supabase
    .from('rg_items').select('*').eq('rg_no', rgNo).order('id');
  if (e2) return res.status(500).json({ error: e2.message });
  res.json({ ...header, items: items || [] });
});

export default router;
