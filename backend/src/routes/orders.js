import { Router } from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import { supabase } from '../lib/supabase.js';
import { requireRole } from '../lib/auth.js';
import { autoAssignPending } from '../lib/areaRules.js';
import { toISODate, parseWorkbook } from '../lib/importExcel.js';
import { applySearch } from '../lib/search.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// บันทึกประวัติสถานะ (best-effort — ไม่ให้ล้ม request หลัก)
async function track(rg_no, status, action_by, extra = {}) {
  await supabase.from('order_tracking').insert({ rg_no, status, action_by, ...extra });
}

// บันทึกผู้กรอกวันที่ "แยกตามช่อง" — กันกรณีกรอกวันรับ+วันกลับคลังพร้อมกัน
//   จะได้ tracking ทั้ง received และ returned เพื่อให้ User RCV / User Return ในรายงานครบ
//   prev = order เดิมก่อน update (ใช้เช็คว่าช่องนี้เพิ่งถูกกรอกครั้งแรก)
async function trackDates(rg_no, action_by, prev, { received_date, returned_date }, note) {
  if (received_date && !prev.received_date) await track(rg_no, 'received', action_by, { note });
  if (returned_date && !prev.returned_date) await track(rg_no, 'returned', action_by, { note });
}

async function loadOrder(rgNo) {
  const { data } = await supabase.from('rg_headers').select('*').eq('rg_no', rgNo).maybeSingle();
  return data;
}

const now = () => new Date().toISOString();

// ค้นหาออเดอร์ — ใช้ตัวกลางร่วมกับ Export (lib/search.js) ให้ผลลัพธ์ตรงกันเสมอ

// GET /api/orders — list ตาม role + filter (status, q) + paginate
router.get('/', async (req, res) => {
  const { role, id } = req.user;
  const { status, q, area } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));

  let query = supabase.from('rg_headers').select('*', { count: 'exact' });
  // ขอบเขตข้อมูลตาม role: vendor เห็นเฉพาะงานตัวเอง; gr/supervisor/admin เห็นหมด
  if (role === 'vendor') query = query.eq('vendor_id', id);

  // status รับได้ทั้งค่าเดียว และหลายค่าคั่นด้วย comma (เช่น returned,gr_received)
  if (status) {
    const list = String(status).split(',').map((s) => s.trim()).filter(Boolean);
    query = list.length > 1 ? query.in('status', list) : query.eq('status', list[0] || status);
  }
  if (area && area.trim()) query = query.ilike('area', `%${area.trim()}%`);
  query = applySearch(query, q); // ค้นหาหลายค่า (comma=OR, เว้นวรรค=AND) ในหลายคอลัมน์
  query = query.order('status_rank', { ascending: true }).order('rg_no', { ascending: true });
  query = query.range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data, page, pageSize, total: count ?? 0 });
});

// GET /api/orders/:rgNo/tracking — ประวัติสถานะ
router.get('/:rgNo/tracking', async (req, res) => {
  const { data, error } = await supabase
    .from('order_tracking')
    .select('*, users:action_by(display_name, role)')
    .eq('rg_no', req.params.rgNo)
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// GET /api/orders/unassigned  (supervisor) — ออเดอร์รอจัดพื้นที่ (ยังไม่มี Vendor)
router.get('/unassigned', requireRole('supervisor'), async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 50));
  let query = supabase.from('rg_headers').select('*', { count: 'exact' }).eq('status', 'pending');
  query = applySearch(query, req.query.q); // ค้นหาหลายค่าเหมือนหน้า list
  query = query.order('rg_date', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data, page, pageSize, total: count ?? 0 });
});

// POST /api/orders/auto-assign  (supervisor) — Re-assign: จับคู่ order pending ทั้งหมดตามกติกาปัจจุบัน
router.post('/auto-assign', requireRole('supervisor'), async (req, res) => {
  try {
    const r = await autoAssignPending({ actionBy: req.user.id });
    res.json({ assigned: r.assigned, waiting: r.waiting, new_shops: r.newShops });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// เปลี่ยน Vendor ของ order ที่ "เลยขั้น pending มาแล้ว" ต้องคงสถานะ + assigned_at เดิมไว้
//   ถ้า reset assigned_at ใหม่ KPI ช่วง 1 (รับสินค้า − มอบหมาย) จะเพี้ยนย้อนหลังทันที
//   pending → ถือเป็นการมอบหมายครั้งแรก จึงเลื่อนสถานะ + ประทับวันมอบหมาย
// สินค้าเข้าคลังแล้ว (gr_received) หรือปิดงานแล้ว — งานของ Vendor จบไปแล้ว ห้ามเปลี่ยน
const REASSIGNABLE = ['pending', 'assigned_vendor', 'received', 'returned'];
function assignPatch(order, vendor_id, adminId) {
  const first = order.status === 'pending';
  return {
    vendor_id,
    admin_id: adminId,
    ...(first ? { status: 'assigned_vendor', assigned_at: now() } : {}),
    updated_at: now(),
  };
}

// PUT /api/orders/bulk-assign-vendor  (supervisor) — assign มือ / เปลี่ยน Vendor
//   { rg_nos: [...], vendor_id }
router.put('/bulk-assign-vendor', requireRole('supervisor'), async (req, res) => {
  const { rg_nos, vendor_id } = req.body || {};
  if (!Array.isArray(rg_nos) || !rg_nos.length) return res.status(400).json({ error: 'กรุณาเลือกออเดอร์' });
  if (!vendor_id) return res.status(400).json({ error: 'กรุณาเลือก Vendor' });

  const { data: valid, error: se } = await supabase
    .from('rg_headers').select('rg_no, status, vendor_id').in('rg_no', rg_nos).in('status', REASSIGNABLE);
  if (se) return res.status(500).json({ error: se.message });
  // ตัดใบที่เป็น Vendor เดิมอยู่แล้วออก — ไม่ต้องเขียนทับ/ไม่ต้องบันทึกประวัติซ้ำ
  const targets = (valid || []).filter((r) => r.vendor_id !== vendor_id);
  const skipped = rg_nos.length - targets.length;
  if (!targets.length) return res.json({ assigned: 0, skipped });

  // สถานะต่างกันต้อง patch ต่างกัน — แยกเป็น 2 กลุ่ม (pending = มอบหมายครั้งแรก / ที่เหลือ = เปลี่ยน Vendor)
  const firstTime = targets.filter((r) => r.status === 'pending').map((r) => r.rg_no);
  const changing = targets.filter((r) => r.status !== 'pending').map((r) => r.rg_no);

  if (firstTime.length) {
    const { error } = await supabase.from('rg_headers')
      .update(assignPatch({ status: 'pending' }, vendor_id, req.user.id)).in('rg_no', firstTime);
    if (error) return res.status(500).json({ error: error.message });
  }
  if (changing.length) {
    const { error } = await supabase.from('rg_headers')
      .update(assignPatch({ status: 'assigned_vendor' }, vendor_id, req.user.id)).in('rg_no', changing);
    if (error) return res.status(500).json({ error: error.message });
  }

  await supabase.from('order_tracking').insert([
    ...firstTime.map((rg_no) => ({ rg_no, status: 'assigned_vendor', action_by: req.user.id, note: 'assign มือ' })),
    ...changing.map((rg_no) => {
      const prev = targets.find((t) => t.rg_no === rg_no);
      return { rg_no, status: prev.status, action_by: req.user.id, note: 'เปลี่ยน Vendor' };
    }),
  ]);
  res.json({ assigned: targets.length, skipped });
});

// PUT /api/orders/:rgNo/assign-vendor  (supervisor) — { vendor_id } · assign มือ / เปลี่ยน Vendor รายใบ
router.put('/:rgNo/assign-vendor', requireRole('supervisor'), async (req, res) => {
  const { vendor_id } = req.body || {};
  if (!vendor_id) return res.status(400).json({ error: 'กรุณาเลือก Vendor' });
  const order = await loadOrder(req.params.rgNo);
  if (!order) return res.status(404).json({ error: 'ไม่พบ Order' });
  if (!REASSIGNABLE.includes(order.status)) return res.status(400).json({ error: 'งานปิดแล้ว เปลี่ยน Vendor ไม่ได้' });
  if (order.vendor_id === vendor_id) return res.json({ ok: true, unchanged: true });

  const { error } = await supabase
    .from('rg_headers')
    .update(assignPatch(order, vendor_id, req.user.id))
    .eq('rg_no', req.params.rgNo);
  if (error) return res.status(500).json({ error: error.message });
  await track(req.params.rgNo, order.status === 'pending' ? 'assigned_vendor' : order.status,
    req.user.id, { note: order.status === 'pending' ? 'assign มือ' : 'เปลี่ยน Vendor' });
  res.json({ ok: true });
});

// ---- Vendor: กรอกวันที่รับสินค้าจริง / วันนำสินค้ากลับคืนคลังจริง ----

// สถานะหลัง vendor อัปเดตวันที่ — ปิดงานแล้วห้ามแก้
//   ถ้า GR รับเข้าระบบไปแล้ว (gr_received) ห้ามถอยสถานะกลับมาเป็น returned/received
//   ไม่งั้นแก้วันที่ทีเดียวงานจะหลุดออกจากคิวของ GR และ Remark ค้างอยู่โดยไม่มีใครเห็น
function vendorStatus(order, { received_date, returned_date }) {
  if (order.status === 'gr_received') return order.status;
  const rec = received_date ?? order.received_date;
  const ret = returned_date ?? order.returned_date;
  if (ret) return 'returned';
  if (rec) return 'received';
  return order.status;
}

// วันนี้ตามเวลาไทย (UTC+7) — กันเคสเซิร์ฟเวอร์อยู่คนละ timezone แล้วตัดวันเร็ว/ช้าไป
const todayTH = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);

// ตรวจลำดับวันที่ให้สมเหตุสมผล — ผสมค่าใหม่ที่กำลังบันทึกกับค่าเดิมในฐานข้อมูล
//   กติกา: กลับคลัง ≥ รับสินค้า (เท่ากันได้) · ห้ามกรอกวันล่วงหน้า (ทำเสร็จแล้วค่อยกรอก)
//   ไม่บังคับ "รับสินค้า ≥ วันมอบหมาย" — Vendor คีย์ย้อนหลังได้
//     เพราะของจริงมักไปรับก่อน แล้วออเดอร์เพิ่งถูก upload/มอบหมายเข้าระบบทีหลัง
//     (KPI ช่วง 1 จะติดลบได้ในเคสนี้ ถือว่าปกติ = ทำงานก่อนออเดอร์เข้าระบบ)
//   คืนข้อความ error ถ้าผิดกติกา · คืน null ถ้าผ่าน
function dateOrderError(order, { received_date, returned_date }) {
  const day = (d) => (d ? String(d).slice(0, 10) : null); // เทียบเฉพาะวันที่ (yyyy-mm-dd)
  // ห้ามวันอนาคต — ตรวจเฉพาะค่าที่กรอกเข้ามารอบนี้ (ค่าเดิมใน DB ไม่ตรวจ ไม่งั้นแก้อะไรไม่ได้เลย)
  const today = todayTH();
  const newRec = day(received_date);
  if (newRec && newRec > today) return `วันที่รับสินค้า (${newRec}) เป็นวันล่วงหน้า — กรอกได้เมื่อทำเสร็จแล้ว`;
  // วันกลับคลัง: ใส่วันล่วงหน้าได้ (นัดหมายรอบรถ) ขอแค่ไม่น้อยกว่าวันที่รับ

  const rec = day(received_date ?? order.received_date);
  const ret = day(returned_date ?? order.returned_date);
  if (ret && rec && ret < rec) return `วันกลับคลัง (${ret}) ก่อนวันรับสินค้า (${rec})`;
  return null;
}

// PUT /api/orders/:rgNo/vendor-dates  (vendor) — { received_date?, returned_date? }
router.put('/:rgNo/vendor-dates', requireRole('vendor'), async (req, res) => {
  const order = await loadOrder(req.params.rgNo);
  if (!order) return res.status(404).json({ error: 'ไม่พบ Order' });
  if (req.user.role === 'vendor' && order.vendor_id !== req.user.id) return res.status(403).json({ error: 'ไม่ใช่งานของคุณ' });
  if (order.status === 'completed') return res.status(400).json({ error: 'งานปิดแล้ว แก้วันที่ไม่ได้' });

  const { received_date, returned_date } = req.body || {};
  if (!received_date && !returned_date) return res.status(400).json({ error: 'กรุณากรอกวันที่' });
  const derr = dateOrderError(order, { received_date, returned_date });
  if (derr) return res.status(400).json({ error: derr });
  const patch = { updated_at: now() };
  if (received_date) patch.received_date = received_date;
  if (returned_date) patch.returned_date = returned_date;
  patch.status = vendorStatus(order, patch);

  const { error } = await supabase.from('rg_headers').update(patch)
    .eq('rg_no', req.params.rgNo).neq('status', 'completed');
  if (error) return res.status(500).json({ error: error.message });
  await trackDates(req.params.rgNo, req.user.id, order, { received_date, returned_date },
    [received_date && `รับ ${received_date}`, returned_date && `กลับคลัง ${returned_date}`].filter(Boolean).join(' · '));
  res.json({ ok: true });
});

// PUT /api/orders/bulk-vendor-dates  (vendor) — { rg_nos, received_date?, returned_date? }
router.put('/bulk-vendor-dates', requireRole('vendor'), async (req, res) => {
  const { rg_nos, received_date, returned_date } = req.body || {};
  if (!Array.isArray(rg_nos) || !rg_nos.length) return res.status(400).json({ error: 'กรุณาเลือกออเดอร์' });
  if (!received_date && !returned_date) return res.status(400).json({ error: 'กรุณากรอกวันที่' });

  let sel = supabase.from('rg_headers').select('rg_no, status, assigned_at, received_date, returned_date').in('rg_no', rg_nos);
  if (req.user.role === 'vendor') sel = sel.eq('vendor_id', req.user.id);
  const { data: targets, error: se } = await sel;
  if (se) return res.status(500).json({ error: se.message });
  const list = (targets || []).filter((t) => t.status !== 'completed');
  const locked = (targets || []).length - list.length;
  if (!list.length) return res.status(400).json({ error: locked ? 'งานที่เลือกปิดแล้ว แก้วันที่ไม่ได้' : 'ไม่พบออเดอร์ของคุณตามที่เลือก' });

  let updated = 0;
  const badDates = []; // RG ที่วันที่ผิดลำดับ — ข้ามแล้วแจ้งกลับ
  for (const t of list) {
    const derr = dateOrderError(t, { received_date, returned_date });
    if (derr) { badDates.push(`${t.rg_no} (${derr})`); continue; }
    const patch = { updated_at: now() };
    if (received_date) patch.received_date = received_date;
    if (returned_date) patch.returned_date = returned_date;
    patch.status = vendorStatus(t, patch);
    const { error } = await supabase.from('rg_headers').update(patch)
      .eq('rg_no', t.rg_no).neq('status', 'completed');
    if (!error) {
      updated++;
      await trackDates(t.rg_no, req.user.id, t, { received_date, returned_date }, 'bulk');
    }
  }
  res.json({ updated, locked, bad_dates: badDates });
});

// PUT /api/orders/bulk-vendor-notes  (vendor) — { rg_nos, rows:[{category,reason}] }
//   แทนที่หมวด/เหตุผล ทั้งชุดของทุกออเดอร์ที่เลือก (เลือกหมวดแล้วต้องกรอกเหตุผล)
router.put('/bulk-vendor-notes', requireRole('vendor'), async (req, res) => {
  const { rg_nos } = req.body || {};
  if (!Array.isArray(rg_nos) || !rg_nos.length) return res.status(400).json({ error: 'กรุณาเลือกออเดอร์' });
  const { rows, error: ve } = cleanNotes(req.body?.rows);
  if (ve) return res.status(400).json({ error: ve });
  if (!rows.length) return res.status(400).json({ error: 'กรุณาเลือกหมวดและกรอกเหตุผล' });

  // เฉพาะงานของ vendor นี้
  let sel = supabase.from('rg_headers').select('rg_no').in('rg_no', rg_nos);
  if (req.user.role === 'vendor') sel = sel.eq('vendor_id', req.user.id);
  const { data: targets, error: se } = await sel;
  if (se) return res.status(500).json({ error: se.message });
  const mine = (targets || []).map((t) => t.rg_no);
  const notMine = rg_nos.length - mine.length;
  if (!mine.length) return res.status(400).json({ error: 'ไม่พบออเดอร์ของคุณตามที่เลือก' });

  let updated = 0, saved = 0, insertErr = null;
  for (const rgNo of mine) {
    await supabase.from('rg_vendor_notes').delete().eq('rg_no', rgNo);
    const payload = rows.map((n) => ({ ...n, rg_no: rgNo, created_by: req.user.id }));
    const { error } = await supabase.from('rg_vendor_notes').insert(payload);
    if (error) { insertErr = error; continue; }
    saved += rows.length; updated++;
  }
  // ไม่มีรายการไหนบันทึกได้เลย (เช่น ยังไม่ได้รัน vendor_notes.sql) — แจ้ง error แทนที่จะเงียบ
  if (!updated && insertErr) return res.status(500).json({ error: insertErr.message });
  res.json({ updated, saved, not_mine: notMine });
});

// GET /api/orders/vendor-template  (vendor) — ไฟล์เดียว: วันที่รับ/กลับคลัง + หมวด/เหตุผล
//   1 ออเดอร์ = อย่างน้อย 1 แถว (แตกแถวตามจำนวนหมวด) · วันที่ใส่เฉพาะแถวแรกของแต่ละ RG
//   เคารพ filter เดียวกับหน้า "งานที่ได้รับมอบหมาย" (สถานะ + ค้นหา)
router.get('/vendor-template', requireRole('vendor'), async (req, res) => {
  let q = supabase.from('rg_headers').select('*');
  if (req.user.role === 'vendor') q = q.eq('vendor_id', req.user.id);
  if (req.query.status) q = q.eq('status', req.query.status);
  q = applySearch(q, req.query.q);
  const { data: heads, error } = await q.order('rg_no', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });

  const rgNos = (heads || []).map((h) => h.rg_no);
  const notesByRg = new Map();
  if (rgNos.length) {
    const { data: notes } = await supabase
      .from('rg_vendor_notes').select('rg_no, category, reason')
      .in('rg_no', rgNos).order('id', { ascending: true });
    for (const n of notes || []) {
      if (!notesByRg.has(n.rg_no)) notesByRg.set(n.rg_no, []);
      notesByRg.get(n.rg_no).push(n);
    }
  }

  const fmt = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');
  const rows = [];
  for (const h of heads || []) {
    const ns = notesByRg.get(h.rg_no) || [{ category: '', reason: '' }];
    ns.forEach((n, i) => rows.push({
      'เลขที่ RG': h.rg_no,
      'สถานะ': h.status,
      'ร้านค้า': h.sold_to_name,
      'อำเภอ': h.district,
      'จังหวัด': h.province,
      'กล่อง': h.qty_boxes,
      'ชิ้น': h.qty_pieces,
      // วันที่ใส่เฉพาะแถวแรกของแต่ละออเดอร์ (แถวถัดไปเว้นว่าง)
      'วันที่รับสินค้า (dd/mm/yyyy)': i === 0 ? fmt(h.received_date) : '',
      'วันที่กลับคลัง (dd/mm/yyyy)': i === 0 ? fmt(h.returned_date) : '',
      'หมวด': n.category,
      'เหตุผล': n.reason,
    }));
  }
  const ws = xlsx.utils.json_to_sheet(rows.length ? rows : [{
    'เลขที่ RG': '', 'สถานะ': '', 'ร้านค้า': '', 'อำเภอ': '', 'จังหวัด': '',
    'กล่อง': '', 'ชิ้น': '', 'วันที่รับสินค้า (dd/mm/yyyy)': '',
    'วันที่กลับคลัง (dd/mm/yyyy)': '', 'หมวด': '', 'เหตุผล': '',
  }]);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'MyJobs');
  const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="vendor-template.xlsx"');
  res.end(buf);
});

// POST /api/orders/vendor-import  (vendor) — ไฟล์เดียว: อัปเดตวันที่ + แทนที่หมวด/เหตุผล
router.post('/vendor-import', requireRole('vendor'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ไม่พบไฟล์ (field name ต้องเป็น "file")' });
  let rows;
  try {
    const wb = xlsx.read(req.file.buffer, { type: 'buffer', cellDates: true });
    // raw:true + cellDates: วันที่มาเป็น Date/serial (ไม่กำกวมกับ locale) — หมวด/เหตุผล coerce เป็น string เองตอนอ่าน
    rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: true });
  } catch (e) {
    return res.status(400).json({ error: 'อ่านไฟล์ Excel ไม่ได้: ' + e.message });
  }

  const hi = rows.findIndex((r) => r.some((c) => /เลขที่ RG/i.test(String(c ?? ''))));
  if (hi < 0) return res.status(400).json({ error: 'ไม่พบหัวคอลัมน์ "เลขที่ RG" ในไฟล์' });
  const hdr = rows[hi].map((c) => String(c ?? ''));
  const cRg = hdr.findIndex((h) => /เลขที่ RG/i.test(h));
  const cRecv = hdr.findIndex((h) => /วันที่รับ/i.test(h));
  const cRet = hdr.findIndex((h) => /กลับคลัง|กลับคืน/i.test(h));
  const cCat = hdr.findIndex((h) => /หมวด/i.test(h));
  const cRea = hdr.findIndex((h) => /เหตุผล/i.test(h));
  if (cRecv < 0 && cRet < 0 && cCat < 0 && cRea < 0) {
    return res.status(400).json({ error: 'ไม่พบหัวคอลัมน์วันที่ หรือ หมวด/เหตุผล ในไฟล์' });
  }

  // งานของ vendor นี้เท่านั้น
  let sel = supabase.from('rg_headers').select('rg_no, status, assigned_at, received_date, returned_date');
  if (req.user.role === 'vendor') sel = sel.eq('vendor_id', req.user.id);
  const { data: mine } = await sel;
  const mymap = new Map((mine || []).map((r) => [r.rg_no, r]));

  // เก็บวันที่ (ต่อ RG — เอาค่าที่กรอกล่าสุด) และแตกหมวดต่อ RG
  const dateByRg = new Map();       // rgNo -> { received_date?, returned_date? }
  const notesByRg = new Map();      // rgNo -> [{category, reason}]
  const seenNotes = new Set();      // RG ที่ปรากฏในไฟล์ (ใช้ตัดสินว่าจะแทนที่หมวด)
  let notMine = 0, badRow = 0;
  for (const r of rows.slice(hi + 1)) {
    const rgNo = String(r[cRg] ?? '').trim();
    if (!/^\d{3}-\d{4}-\d{4,}$/.test(rgNo)) continue;
    if (!mymap.has(rgNo)) { notMine++; continue; }

    // ---- วันที่ (ถ้ามีในแถวนี้) ----
    const received_date = cRecv >= 0 ? toISODate(r[cRecv]) : null;
    const returned_date = cRet >= 0 ? toISODate(r[cRet]) : null;
    if (received_date || returned_date) {
      const d = dateByRg.get(rgNo) || {};
      if (received_date) d.received_date = received_date;
      if (returned_date) d.returned_date = returned_date;
      dateByRg.set(rgNo, d);
    }

    // ---- หมวด/เหตุผล ----
    if (cCat >= 0 || cRea >= 0) {
      seenNotes.add(rgNo);
      if (!notesByRg.has(rgNo)) notesByRg.set(rgNo, []);
      const category = cCat >= 0 ? String(r[cCat] ?? '').trim() : '';
      const reason = cRea >= 0 ? String(r[cRea] ?? '').trim() : '';
      if (!category && !reason) continue;                 // แถวว่าง = ล้างหมวดของ RG นี้
      if (!category || !reason) { badRow++; continue; }   // ไม่ครบ = ข้ามแถว
      notesByRg.get(rgNo).push({ category, reason });
    }
  }

  // ---- บันทึกวันที่ ----
  let updated = 0, skipped = 0, locked = 0;
  const badDates = []; // RG ที่วันที่ผิดลำดับ — ข้ามแล้วแจ้งกลับ
  for (const [rgNo, d] of dateByRg) {
    const cur = mymap.get(rgNo);
    if (cur.status === 'completed') { locked++; continue; }         // ปิดงานแล้ว — แก้ไม่ได้
    const derr = dateOrderError(cur, d);
    if (derr) { badDates.push(`${rgNo} (${derr})`); continue; }     // วันที่ผิดลำดับ — ข้าม
    const patch = { updated_at: now(), ...d };
    patch.status = vendorStatus(cur, patch);
    const { error } = await supabase.from('rg_headers').update(patch)
      .eq('rg_no', rgNo).neq('status', 'completed');
    if (!error) { updated++; await trackDates(rgNo, req.user.id, cur, d, '(excel)'); }
  }

  // ---- แทนที่หมวด/เหตุผล (เฉพาะ RG ที่ปรากฏในไฟล์) ----
  let notesUpdated = 0, notesSaved = 0;
  for (const rgNo of seenNotes) {
    const list = notesByRg.get(rgNo) || [];
    await supabase.from('rg_vendor_notes').delete().eq('rg_no', rgNo);
    if (list.length) {
      const payload = list.map((n) => ({ ...n, rg_no: rgNo, created_by: req.user.id }));
      const { error } = await supabase.from('rg_vendor_notes').insert(payload);
      if (error) continue;
      notesSaved += list.length;
    }
    notesUpdated++;
  }

  res.json({
    updated, skipped, not_mine: notMine, locked,
    notes_updated: notesUpdated, notes_saved: notesSaved, bad_rows: badRow,
    bad_dates: badDates,
  });
});

// ---- Vendor: หมวด + เหตุผล ต่อออเดอร์ (ตารางที่ add/remove แถวได้) ----

// ตรวจว่า order เป็นของ vendor คนนี้ (supervisor ผ่านหมด) — คืน order หรือ null
async function ownOrder(req) {
  const order = await loadOrder(req.params.rgNo);
  if (!order) return { err: 404, msg: 'ไม่พบ Order' };
  if (req.user.role === 'vendor' && order.vendor_id !== req.user.id) return { err: 403, msg: 'ไม่ใช่งานของคุณ' };
  return { order };
}

// รับ rows จาก body → คืน { rows } ที่ผ่าน validate หรือ { error }
function cleanNotes(raw) {
  if (!Array.isArray(raw)) return { error: 'รูปแบบข้อมูลไม่ถูกต้อง' };
  const rows = [];
  for (const r of raw) {
    const category = String(r?.category ?? '').trim();
    const reason = String(r?.reason ?? '').trim();
    if (!category && !reason) continue;                 // แถวว่าง — ข้าม
    if (!category) return { error: 'กรุณาเลือกหมวดให้ครบทุกแถว' };
    if (!reason) return { error: 'เลือกหมวดแล้วต้องกรอกเหตุผลให้ครบทุกแถว' };
    rows.push({ category, reason });
  }
  return { rows };
}

// GET /api/orders/:rgNo/vendor-notes  (vendor) — รายการหมวด+เหตุผลของออเดอร์
router.get('/:rgNo/vendor-notes', requireRole('vendor'), async (req, res) => {
  const chk = await ownOrder(req);
  if (chk.err) return res.status(chk.err).json({ error: chk.msg });
  const { data, error } = await supabase
    .from('rg_vendor_notes').select('id, category, reason')
    .eq('rg_no', req.params.rgNo).order('id', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// PUT /api/orders/:rgNo/vendor-notes  (vendor) — แทนที่ทั้งชุด { rows: [{category, reason}] }
router.put('/:rgNo/vendor-notes', requireRole('vendor'), async (req, res) => {
  const chk = await ownOrder(req);
  if (chk.err) return res.status(chk.err).json({ error: chk.msg });
  const { rows, error: ve } = cleanNotes(req.body?.rows);
  if (ve) return res.status(400).json({ error: ve });

  await supabase.from('rg_vendor_notes').delete().eq('rg_no', req.params.rgNo);
  if (rows.length) {
    const payload = rows.map((r) => ({ ...r, rg_no: req.params.rgNo, created_by: req.user.id }));
    const { error } = await supabase.from('rg_vendor_notes').insert(payload);
    if (error) return res.status(500).json({ error: error.message });
  }
  res.json({ ok: true, saved: rows.length });
});


// ---- GR: Upload ReportRG ปิดงานตาม "วันที่สร้าง Doc. WH" ----
// POST /api/orders/gr-import  (gr) — multipart: file (ReportRG-*.xlsx)
router.post('/gr-import', requireRole('gr'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ไม่พบไฟล์ (field name ต้องเป็น "file")' });
  let parsed;
  try {
    parsed = parseWorkbook(req.file.buffer);
  } catch (e) {
    return res.status(400).json({ error: 'อ่านไฟล์ Excel ไม่ได้: ' + e.message });
  }
  if (parsed.format !== 'detail' && parsed.format !== 'close') {
    return res.status(400).json({ error: 'ไฟล์นี้ไม่ใช่ ReportRG/ไฟล์ปิดงาน (ต้องมีคอลัมน์ Invoice / Doc. WH หรือ "ว.ด.ปี ที่ Complete")' });
  }

  try {
    // update-only: ทำเฉพาะเลขที่ RG ที่มีอยู่ใน DB แล้ว · RG ใหม่ในไฟล์ → ข้ามทั้งหมด
    const allRg = [...new Set(parsed.items.map((i) => i.rg_no))];
    const existing = new Set();
    for (let i = 0; i < allRg.length; i += 500) {
      const { data: ex } = await supabase.from('rg_headers').select('rg_no').in('rg_no', allRg.slice(i, i + 500));
      for (const e of ex || []) existing.add(e.rg_no);
    }
    const skippedNew = allRg.length - existing.size;

    // เก็บรายการสินค้า (ดี/เสีย) — เฉพาะ RG ที่มีใน DB
    let items = 0;
    const keepRg = allRg.filter((rg) => existing.has(rg));
    if (keepRg.length) {
      const keepItems = parsed.items.filter((it) => existing.has(it.rg_no));
      await supabase.from('rg_items').delete().in('rg_no', keepRg);
      const { error } = await supabase.from('rg_items').insert(keepItems);
      if (error) throw error;
      items = keepItems.length;
    }

    // รับสินค้าเข้าระบบ / ปิดงาน: RG ที่มี "วันที่สร้าง Doc. WH" = สินค้าเข้าคลังแล้ว
    //   มี Remark  → gr_received (รับสินค้าเข้าระบบ) — ค้างไว้ให้ตามเคลียร์ Remark ก่อน
    //   ไม่มี Remark → completed  (ปิดงาน)
    let completed = 0, grReceived = 0, already = 0, noDate = 0;
    const withDate = new Set(parsed.completions.map((c) => c.rg_no));
    noDate = [...existing].filter((rg) => !withDate.has(rg)).length;

    for (const c of parsed.completions) {
      if (!existing.has(c.rg_no)) continue; // RG ใหม่ → ข้าม
      const { data: cur } = await supabase
        .from('rg_headers').select('status').eq('rg_no', c.rg_no).maybeSingle();
      if (!cur) continue;
      if (cur.status === 'completed') { already++; continue; }
      const remark = (c.remark || '').trim();
      const status = remark ? 'gr_received' : 'completed';
      // มี Remark = ยังไม่ปิดงานจริง จึงยังไม่ประทับ completed_date (KPI ช่วง 3 นับจากช่องนี้)
      //   เก็บวันที่รับเข้าระบบไว้ที่ gr_received_date ไปก่อน แล้วค่อยยกไปตอนปิดงาน
      const { error } = await supabase.from('rg_headers')
        .update({
          doc_wh: c.doc_wh, status, gr_remark: remark || null, updated_at: now(),
          ...(remark
            ? { gr_received_date: c.completed_date }
            : { completed_date: c.completed_date, gr_received_date: c.completed_date }),
        })
        .eq('rg_no', c.rg_no);
      if (!error) {
        if (status === 'completed') completed++; else grReceived++;
        const docNote = `Doc. WH ${c.doc_wh || '-'} · ${c.completed_date}`;
        // สินค้าเข้าคลังทั้ง 2 กรณี → บันทึก gr_received เสมอ (เป็นที่มาของ วันที่/User WH RCV ในรายงาน)
        await track(c.rg_no, 'gr_received', req.user.id, {
          note: docNote + (remark ? ` · Remark: ${remark}` : ''),
        });
        // ไม่มี Remark = ปิดงานในขั้นตอนเดียวกัน → บันทึกอีกแถวเป็นผู้ปิดงาน
        if (status === 'completed') await track(c.rg_no, 'completed', req.user.id, { note: docNote });
      }
    }
    res.json({ items, completed, gr_received: grReceived, already_completed: already, no_doc_date: noDate, skipped_new: skippedNew });
  } catch (e) {
    res.status(500).json({ error: 'บันทึกลงฐานข้อมูลไม่สำเร็จ: ' + e.message });
  }
});

// POST /api/orders/:rgNo/complete  (gr) — ปิดงานรายใบ + แนบเอกสาร (ทางเลือกนอกจากอัปโหลด ReportRG)
router.post('/:rgNo/complete', requireRole('gr'), upload.single('file'), async (req, res) => {
  const order = await loadOrder(req.params.rgNo);
  if (!order) return res.status(404).json({ error: 'ไม่พบ Order' });

  let url = null;
  if (req.file) {
    const { uploadFile } = await import('../lib/storage.js');
    try {
      url = await uploadFile('complete', req.file.originalname, req.file.buffer, req.file.mimetype);
    } catch (e) {
      return res.status(500).json({ error: 'อัปโหลดไฟล์ไม่สำเร็จ: ' + e.message });
    }
  }
  // ใบที่เคยรับเข้าระบบแล้ว (ติด Remark) ใช้วันที่เข้าคลังจริงเป็นวันปิดงาน ไม่ใช่วันที่กดปุ่ม
  const patch = {
    status: 'completed', updated_at: now(),
    completed_date: order.gr_received_date || new Date().toISOString().slice(0, 10),
  };
  if (url) patch.completed_file_url = url;
  const { error } = await supabase.from('rg_headers').update(patch).eq('rg_no', req.params.rgNo);
  if (error) return res.status(500).json({ error: error.message });
  await track(req.params.rgNo, 'completed', req.user.id, { note: url });
  res.json({ ok: true, completed_file_url: url });
});

// POST /api/orders/bulk-complete  (gr) — ปิดงานทีละหลายใบ { rg_nos }
router.post('/bulk-complete', requireRole('gr'), async (req, res) => {
  const { rg_nos } = req.body || {};
  if (!Array.isArray(rg_nos) || !rg_nos.length) return res.status(400).json({ error: 'กรุณาเลือกออเดอร์' });

  const { data: targets, error: se } = await supabase
    .from('rg_headers').select('rg_no, status, gr_received_date').in('rg_no', rg_nos);
  if (se) return res.status(500).json({ error: se.message });
  const list = (targets || []).filter((t) => t.status !== 'completed');
  const already = (targets || []).length - list.length;
  if (!list.length) return res.status(400).json({ error: already ? 'งานที่เลือกปิดแล้วทั้งหมด' : 'ไม่พบออเดอร์ตามที่เลือก' });

  const today = new Date().toISOString().slice(0, 10);
  let completed = 0;
  for (const t of list) {
    // ใบที่เคยรับเข้าระบบแล้ว (ติด Remark) ใช้วันที่รับเข้าคลังจริงเป็นวันปิดงาน ไม่ใช่วันที่กดปุ่ม
    const completed_date = t.gr_received_date || today;
    const { error } = await supabase.from('rg_headers')
      .update({ status: 'completed', completed_date, updated_at: now() })
      .eq('rg_no', t.rg_no).neq('status', 'completed');
    if (!error) { completed++; await track(t.rg_no, 'completed', req.user.id, { note: 'เคลียร์ Remark' }); }
  }
  res.json({ completed, already_completed: already });
});

// PUT /api/orders/:rgNo  (supervisor) — แก้ไขทุก field
router.put('/:rgNo', requireRole('supervisor'), async (req, res) => {
  const allowed = [
    'zone', 'sold_to', 'sold_to_code', 'sold_to_name', 'ship_to_code', 'ship_to_name',
    'qty_boxes', 'qty_pieces', 'reason_note', 'wh_code', 'reason_code', 'reason_text',
    'rg_date', 'sales_org', 'contact_name', 'contact_phone', 'sales_person',
    'province', 'district', 'region', 'area', 'status', 'vendor_id',
    'received_date', 'returned_date', 'completed_date', 'gr_received_date', 'gr_remark',
  ];
  const patch = { updated_at: now() };
  for (const k of allowed) if (k in (req.body || {})) patch[k] = req.body[k];

  const { error } = await supabase.from('rg_headers').update(patch).eq('rg_no', req.params.rgNo);
  if (error) return res.status(500).json({ error: error.message });
  await track(req.params.rgNo, 'edited', req.user.id);
  res.json({ ok: true });
});

export default router;
