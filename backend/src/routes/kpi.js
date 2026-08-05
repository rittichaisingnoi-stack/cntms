import { Router } from 'express';
import xlsx from 'xlsx';
import { supabase } from '../lib/supabase.js';

const router = Router();

// KPI 3 ช่วง (หน่วย: วัน)
//  d1 = รับสินค้าแล้ว − วันที่พิมพ์    (received_date − rg_date)
//  d2 = นำกลับคลังแล้ว − รับสินค้าแล้ว (returned_date − received_date)
//  d3 = ปิดงาน − รับสินค้าแล้ว        (completed_date − received_date)

const DAY = 86400000;
const days = (a, b) => {
  if (!a || !b) return null;
  const da = new Date(String(a).slice(0, 10)), db = new Date(String(b).slice(0, 10));
  if (isNaN(da) || isNaN(db)) return null;
  return Math.round((db - da) / DAY);
};
// Vendor คีย์ย้อนหลังได้ → วันรับสินค้าอาจอยู่ก่อนวันที่พิมพ์ ทำให้ d1 ติดลบ
//   เคสนี้คือไปรับของก่อนที่ออเดอร์จะเข้าระบบ นับเป็น 0 วัน (ไม่ใช่ค่าลบที่จะดึงค่าเฉลี่ยเพี้ยน)
const nonNeg = (v) => (v == null ? null : Math.max(0, v));
const kpiOf = (r) => ({
  d1: nonNeg(days(r.rg_date, r.received_date)),
  d2: days(r.received_date, r.returned_date),
  d3: days(r.received_date, r.completed_date),
});

// ดึง order ที่มอบหมายแล้วในช่วงวันที่ (filter ตามวันที่พิมพ์) — vendor เห็นเฉพาะของตัวเอง
async function fetchRows(user, { from, to, vendor_id }) {
  let q = supabase.from('rg_headers')
    .select('rg_no, vendor_id, sold_to_name, status, rg_date, assigned_at, received_date, returned_date, completed_date')
    .not('vendor_id', 'is', null);
  if (user.role === 'vendor') q = q.eq('vendor_id', user.id);
  else if (vendor_id) q = q.eq('vendor_id', vendor_id);
  // rg_date เป็น date ล้วน — เทียบตรงๆ ไม่ต้องต่อเวลาท้ายวันเหมือน timestamptz
  if (from) q = q.gte('rg_date', from);
  if (to) q = q.lte('rg_date', to);
  q = q.order('rg_date', { ascending: false }).limit(5000);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function vendorNames(ids) {
  if (!ids.length) return new Map();
  const { data } = await supabase.from('users').select('id, display_name').in('id', ids);
  return new Map((data || []).map((u) => [u.id, u.display_name]));
}

function summarize(rows) {
  const groups = new Map();
  for (const r of rows) {
    if (!groups.has(r.vendor_id)) groups.set(r.vendor_id, []);
    groups.get(r.vendor_id).push(r);
  }
  const avg = (arr) => {
    const v = arr.filter((x) => x != null);
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  };
  const out = [];
  for (const [vendor_id, list] of groups) {
    const ks = list.map(kpiOf);
    out.push({
      vendor_id,
      orders: list.length,
      completed: list.filter((r) => r.status === 'completed').length,
      avg_assign_to_receive: avg(ks.map((k) => k.d1)),   // วันที่พิมพ์ → รับสินค้า
      avg_receive_to_return: avg(ks.map((k) => k.d2)),
      avg_receive_to_complete: avg(ks.map((k) => k.d3)),
    });
  }
  return out.sort((a, b) => b.orders - a.orders);
}

// GET /api/kpi/summary?from&to — สรุปเฉลี่ยรายวันแยกตาม Vendor + แถวรวมทั้งระบบ
router.get('/summary', async (req, res) => {
  try {
    const rows = await fetchRows(req.user, req.query);
    const summary = summarize(rows);
    const names = await vendorNames(summary.map((s) => s.vendor_id));
    summary.forEach((s) => { s.vendor_name = names.get(s.vendor_id) || `#${s.vendor_id}`; });
    const totalRow = summarize(rows.map((r) => ({ ...r, vendor_id: 0 })))[0] || null;
    if (totalRow) totalRow.vendor_name = 'รวมทั้งระบบ';
    res.json({ vendors: summary, total: totalRow });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/kpi/orders?vendor_id&from&to — KPI รายออเดอร์
router.get('/orders', async (req, res) => {
  try {
    const rows = await fetchRows(req.user, req.query);
    const names = await vendorNames([...new Set(rows.map((r) => r.vendor_id))]);
    res.json(rows.map((r) => ({
      ...r,
      vendor_name: names.get(r.vendor_id) || `#${r.vendor_id}`,
      ...kpiOf(r),
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/kpi/export?type=summary|orders&from&to&vendor_id — ดาวน์โหลด .xlsx
router.get('/export', async (req, res) => {
  try {
    const rows = await fetchRows(req.user, req.query);
    let sheetRows, name;
    if (req.query.type === 'summary') {
      const summary = summarize(rows);
      const names = await vendorNames(summary.map((s) => s.vendor_id));
      sheetRows = summary.map((s) => ({
        'Vendor': names.get(s.vendor_id) || `#${s.vendor_id}`,
        'จำนวนงาน': s.orders,
        'ปิดงานแล้ว': s.completed,
        'วันที่พิมพ์→รับสินค้า (วันเฉลี่ย)': s.avg_assign_to_receive,
        'รับสินค้า→กลับคลัง (วันเฉลี่ย)': s.avg_receive_to_return,
        'รับสินค้า→ปิดงาน (วันเฉลี่ย)': s.avg_receive_to_complete,
      }));
      name = 'kpi-summary';
    } else {
      const names = await vendorNames([...new Set(rows.map((r) => r.vendor_id))]);
      sheetRows = rows.map((r) => {
        const k = kpiOf(r);
        return {
          'เลขที่ RG': r.rg_no,
          'Vendor': names.get(r.vendor_id) || `#${r.vendor_id}`,
          'ร้านค้า': r.sold_to_name,
          'สถานะ': r.status,
          'วันที่พิมพ์': r.rg_date || '',
          'วันที่มอบหมาย': r.assigned_at ? String(r.assigned_at).slice(0, 10) : '',
          'วันที่รับสินค้า': r.received_date || '',
          'วันที่กลับคลัง': r.returned_date || '',
          'วันที่ปิดงาน': r.completed_date || '',
          'วันที่พิมพ์→รับ (วัน)': k.d1,
          'รับ→กลับคลัง (วัน)': k.d2,
          'รับ→ปิดงาน (วัน)': k.d3,
        };
      });
      name = 'kpi-orders';
    }
    const ws = xlsx.utils.json_to_sheet(sheetRows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'KPI');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${name}.xlsx"`);
    res.end(buf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
