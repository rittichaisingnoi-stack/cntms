// ย้อนสถานะใบที่ถูกปิดงานทั้งที่วันที่ไม่ครบ (ข้อมูลค้างจาก upload ก่อนมีกติกาเช็ควันที่)
//   กติกาปัจจุบัน: ปิดงานได้เมื่อมี received_date + returned_date ครบทั้งคู่
//   คืนสถานะจาก tracking ล่าสุดที่ไม่ใช่ completed/gr_received · ไม่มีประวัติ → ดูจาก vendor_id
//
// ใช้งาน:  node src/scripts/revertBadCompletions.js          (dry-run — ดูอย่างเดียว)
//          node src/scripts/revertBadCompletions.js --apply  (แก้จริง)
import 'dotenv/config';
import { supabase } from '../lib/supabase.js';

const APPLY = process.argv.includes('--apply');

const { data: bad, error } = await supabase.from('rg_headers')
  .select('rg_no, status, received_date, returned_date, vendor_id')
  .in('status', ['completed', 'gr_received'])
  .or('received_date.is.null,returned_date.is.null');
if (error) { console.error('อ่านข้อมูลไม่ได้:', error.message); process.exit(1); }
if (!bad.length) { console.log('ไม่พบใบที่ปิดงานทั้งที่วันที่ไม่ครบ'); process.exit(0); }

// สถานะเดิมจาก tracking (แถวล่าสุดที่ไม่ใช่ completed/gr_received)
const rgs = bad.map((r) => r.rg_no);
const prevByRg = new Map();
for (let i = 0; i < rgs.length; i += 200) {
  const { data: tr } = await supabase.from('order_tracking')
    .select('rg_no, status, created_at').in('rg_no', rgs.slice(i, i + 200)).order('created_at');
  for (const t of tr || []) {
    if (!['completed', 'gr_received'].includes(t.status)) prevByRg.set(t.rg_no, t.status);
  }
}

const plan = bad.map((r) => ({
  rg_no: r.rg_no,
  from: r.status,
  to: prevByRg.get(r.rg_no) || (r.vendor_id ? 'assigned_vendor' : 'pending'),
}));

const summary = {};
for (const p of plan) { const k = `${p.from} → ${p.to}`; summary[k] = (summary[k] || 0) + 1; }
console.log(`พบ ${plan.length} ใบที่ปิดงานทั้งที่วันที่ไม่ครบ`);
console.table(summary);

if (!APPLY) {
  console.log('\n(dry-run) ยังไม่แก้อะไร — ใส่ --apply เพื่อแก้จริง');
  console.log('ตัวอย่าง 10 ใบแรก:');
  for (const p of plan.slice(0, 10)) console.log(' ', p.rg_no, p.from, '→', p.to);
  process.exit(0);
}

let done = 0;
for (const p of plan) {
  const { error: e } = await supabase.from('rg_headers').update({
    status: p.to,
    completed_date: null, gr_received_date: null, gr_remark: null, doc_wh: null,
    updated_at: new Date().toISOString(),
  }).eq('rg_no', p.rg_no);
  if (e) { console.error('  พลาด', p.rg_no, e.message); continue; }
  // ลบ tracking ของการปิดงานที่ไม่ถูกต้อง ไม่ให้ KPI นับ
  await supabase.from('order_tracking').delete()
    .eq('rg_no', p.rg_no).in('status', ['completed', 'gr_received']);
  done++;
}
console.log(`\nย้อนกลับแล้ว ${done}/${plan.length} ใบ`);
