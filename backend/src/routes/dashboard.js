import { Router } from 'express';
import xlsx from 'xlsx';
import { supabase } from '../lib/supabase.js';
import { applySearch } from '../lib/search.js';

const router = Router();

const STATUSES = ['pending', 'assigned_vendor', 'received', 'returned', 'completed'];

// จำกัด scope ตาม role เหมือน /api/orders — vendor เห็นเฉพาะงานตัวเอง
function scope(query, user) {
  if (user.role === 'vendor') return query.eq('vendor_id', user.id);
  return query;
}

// GET /api/dashboard/summary — นับตามสถานะ (+ ตัวเลือก from/to ตาม rg_date)
router.get('/summary', async (req, res) => {
  const { from, to } = req.query;
  const counts = {};
  await Promise.all(STATUSES.map(async (st) => {
    let q = supabase.from('rg_headers').select('*', { count: 'exact', head: true }).eq('status', st);
    q = scope(q, req.user);
    if (from) q = q.gte('rg_date', from);
    if (to) q = q.lte('rg_date', to);
    const { count } = await q;
    counts[st] = count ?? 0;
  }));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  // order รอจัดพื้นที่ (ยังไม่มี Vendor — ค้างรอ Supervisor)
  const unassigned = ['supervisor', 'admin'].includes(req.user.role) ? (counts.pending ?? 0) : 0;
  res.json({ counts, total, unassigned });
});

// ค้นหา — ใช้ตัวกลางร่วมกับหน้า list (lib/search.js) ให้ Export ตรงกับที่เห็นบนตารางเสมอ

// GET /api/dashboard/export — ดาวน์โหลดเป็น .xlsx (เคารพ filter เดียวกับหน้าออเดอร์ทั้งหมด)
router.get('/export', async (req, res) => {
  const { from, to, status, area, q: search } = req.query;
  let q = supabase.from('rg_headers').select('*');
  q = scope(q, req.user);
  if (status) q = q.eq('status', status);
  if (area && area.trim()) q = q.ilike('area', `%${area.trim()}%`);
  q = applySearch(q, search);
  if (from) q = q.gte('rg_date', from);
  if (to) q = q.lte('rg_date', to);
  q = q.order('rg_date', { ascending: false });

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });

  const orders = data || [];

  // --- ผู้ใช้: Vendor (vendor_id) + ผู้มอบหมาย (admin_id) ---
  const userIds = new Set();
  for (const r of orders) { if (r.vendor_id) userIds.add(r.vendor_id); if (r.admin_id) userIds.add(r.admin_id); }

  // --- ผู้ทำแต่ละขั้นจาก order_tracking (received/returned/completed) ---
  //     เก็บ action_by ล่าสุดต่อ (rg_no, status)
  const actorBy = new Map(); // `${rg_no}|${status}` -> action_by(userId)
  const rgNos = orders.map((r) => r.rg_no);
  if (rgNos.length) {
    const { data: tracks } = await supabase
      .from('order_tracking')
      .select('rg_no, status, action_by, created_at')
      .in('rg_no', rgNos)
      .in('status', ['received', 'returned', 'completed'])
      .order('created_at', { ascending: true });
    for (const t of tracks || []) {
      if (t.action_by == null) continue;
      actorBy.set(`${t.rg_no}|${t.status}`, t.action_by); // แถวหลังสุด (ล่าสุด) ทับ
      userIds.add(t.action_by);
    }
  }

  // แปลง userId -> ชื่อที่แสดง
  const userName = new Map();
  if (userIds.size) {
    const { data: users } = await supabase.from('users').select('id, display_name').in('id', [...userIds]);
    for (const u of users || []) userName.set(u.id, u.display_name);
  }
  const nameOf = (id) => (id != null ? (userName.get(id) || `#${id}`) : '');
  const actor = (rg, st) => nameOf(actorBy.get(`${rg}|${st}`));

  const rows = orders.map((r) => ({
    'เลขที่ RG': r.rg_no,
    'หมายเลขอ้างอิง': r.reference,
    'สถานะ': r.status,
    'ร้านค้า': r.sold_to_name,
    'Sold To Code': r.sold_to_code,
    'Ship To Code': r.ship_to_code,
    'อำเภอ': r.district,
    'จังหวัด': r.province,
    'Region': r.region,
    'พื้นที่': r.area,
    'Vendor': nameOf(r.vendor_id),
    'กล่อง': r.qty_boxes,
    'ชิ้น': r.qty_pieces,
    'WH': r.wh_code,
    'เหตุผล': r.reason_text,
    'วันที่พิมพ์': r.rg_date,
    'วันที่มอบหมาย': r.assigned_at ? String(r.assigned_at).slice(0, 10) : '',
    'User Assign': nameOf(r.admin_id),
    'วันที่รับ': r.received_date,
    'User RCV': actor(r.rg_no, 'received'),
    'วันที่กลับคลัง': r.returned_date,
    'User Return': actor(r.rg_no, 'returned'),
    'วันที่ปิดงาน': r.completed_date,
    'User Close': actor(r.rg_no, 'completed'),
    'Doc. WH': r.doc_wh,
    'Remark': r.reason_note,
  }));
  const ws = xlsx.utils.json_to_sheet(rows);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Orders');
  const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="orders-export.xlsx"`);
  res.end(buf);
});

export default router;
