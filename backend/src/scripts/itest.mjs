// Integration test — ยิงจริงผ่าน API ทั้ง Flow 3 บทบาท ด้วยข้อมูลทดสอบ (ลบทิ้งท้ายสุด)
import xlsx from 'xlsx';
import bcrypt from 'bcryptjs';
import assert from 'node:assert';
import { supabase } from './src/lib/supabase.js';

const BASE = 'http://localhost:' + (process.env.TEST_PORT || 4712) + '/api';
const RG1 = '999-2026-99001'; // ตรงกติกา → auto assign
const RG2 = '999-2026-99002'; // ร้านใหม่ → รอจัดพื้นที่
const TEST_USERS = ['t_supervisor', 't_vendor', 't_gr'];

let pass = 0, fail = 0;
const t = async (name, fn) => {
  try { await fn(); console.log('  ✓', name); pass++; }
  catch (e) { console.log('  ✗', name, '\n     →', e.message); fail++; }
};

const api = async (token, path, opt = {}) => {
  const headers = { ...(opt.headers || {}) };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(BASE + path, { ...opt, headers });
  const ct = r.headers.get('content-type') || '';
  const body = ct.includes('json') ? await r.json() : await r.arrayBuffer();
  return { status: r.status, body };
};
const json = (o) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
const upload = (buf, name) => {
  const fd = new FormData();
  fd.append('file', new Blob([buf]), name);
  return { body: fd };
};

// ---------- สร้างไฟล์ Excel จำลอง ----------
function makeSummaryXlsx() {
  const rows = [
    ['รายงานสรุป RG', 'test'],
    ['เขต', 'เลขที่ RG', 'Sold To Code', 'Sold To Name', 'Ship To Code', 'Ship To Name',
     'จำนวนชิ้น', 'จำนวนกล่อง', 'หมายเหตุ', 'วันที่พิมพ์', 'Sales Org', 'Sold To'],
    ['153', RG1, '012952', 'ร้านทดสอบ หนึ่ง', 'T001', 'ร้านทดสอบ อ.เมืองสมุทรปราการ จ.สมุทรปราการ 10270',
     72, 1, '(WH:WH08) (เหตุผล:15 : ลูกค้าลด Stock)', '08/07/2026', '16', '129521'],
    ['154', RG2, '099999', 'ร้านใหม่ทดสอบ', 'TNEW', 'ร้านใหม่ อ.บางใหญ่ จ.นนทบุรี 11140',
     10, 2, '(WH:WH08) (เหตุผล:15 : ลูกค้าลด Stock)', '08/07/2026', '16', '888888'],
  ];
  const ws = xlsx.utils.aoa_to_sheet(rows);
  return xlsx.write({ SheetNames: ['Sheet1'], Sheets: { Sheet1: ws } }, { type: 'buffer', bookType: 'xlsx' });
}
function makeReportRGXlsx() {
  const hdr = ['ว.ด.ปี ที่ Key', 'รหัสร้านค้า', 'ชื่อร้านค้า', 'จังหวัด', 'รหัสสินค้า', 'ชื่อสินค้า', 'โหล', 'ชิ้น',
    'เลขที่ Invoice', 'เหตุผลที่ทำ CN', 'เลขที่ RG', 'Doc. WH', 'วันที่สร้าง Doc. WH', 'ประเภทสินค้า', 'จำนวนเงิน'];
  const rows = [hdr,
    ['11.06.2026', '011606', 'ร้านทดสอบ', 'กรุงเทพฯ', '031-0988', 'สินค้า X', 0, 1, '94070859', 'ทดสอบ', RG1, 'DOC-T1', '10.07.2026', 'สินค้าขาย', 36.14],
    ['11.06.2026', '099999', 'ร้านใหม่', 'นนทบุรี', '035-0319', 'สินค้า Y', 1, 0, '94070860', 'ทดสอบ', RG2, 'DOC-T2', '11.07.2026', 'สินค้าขาย', 100],
  ];
  const ws = xlsx.utils.aoa_to_sheet(rows);
  return xlsx.write({ SheetNames: ['Sheet1'], Sheets: { Sheet1: ws } }, { type: 'buffer', bookType: 'xlsx' });
}

// ---------- เตรียม/เก็บกวาดข้อมูลทดสอบ ----------
async function seed() {
  const password_hash = await bcrypt.hash('test1234', 10);
  for (const [username, role] of [['t_supervisor', 'supervisor'], ['t_vendor', 'vendor'], ['t_gr', 'gr']]) {
    const { error } = await supabase.from('users')
      .upsert({ username, password_hash, display_name: username, role, is_active: true }, { onConflict: 'username' });
    if (error) throw new Error('seed ' + username + ': ' + error.message);
  }
}
async function cleanup() {
  await supabase.from('rg_items').delete().in('rg_no', [RG1, RG2]);
  await supabase.from('rg_headers').delete().in('rg_no', [RG1, RG2]); // order_tracking ลบตาม cascade
  await supabase.from('area_rules').delete().like('match_value', 'T%');
  const { data: us } = await supabase.from('users').select('id').in('username', TEST_USERS);
  const ids = (us || []).map((u) => u.id);
  if (ids.length) {
    await supabase.from('sessions').delete().in('user_id', ids);
    await supabase.from('users').delete().in('id', ids);
  }
  console.log('\n🧹 ลบข้อมูลทดสอบเรียบร้อย (RG ทดสอบ, กติกาทดสอบ, ผู้ใช้ทดสอบ)');
}

// ---------- MAIN ----------
try {
  await seed();
  const login = async (u) => (await api(null, '/auth/login', { method: 'POST', ...json({ username: u, password: 'test1234' }) })).body;
  const sup = await login('t_supervisor');
  const ven = await login('t_vendor');
  const gr = await login('t_gr');

  console.log('1) Login 3 บทบาท');
  await t('supervisor / vendor / gr login ได้', () => {
    assert.ok(sup.token && ven.token && gr.token, JSON.stringify({ sup, ven, gr }));
  });

  console.log('2) Supervisor: ตั้งกติกา + Upload → Auto Assign');
  await t('เพิ่มกติกา Sold To Code 012952 → t_vendor', async () => {
    const r = await api(sup.token, '/admin/area-rules', { method: 'POST', ...json({ rule_field: 'sold_to_code', match_value: '012952', vendor_id: ven.user.id }) });
    assert.equal(r.status, 200, JSON.stringify(r.body));
  });
  await t('กติกาไม่มี vendor → 400', async () => {
    const r = await api(sup.token, '/admin/area-rules', { method: 'POST', ...json({ rule_field: 'zone', match_value: 'T99' }) });
    assert.equal(r.status, 400);
  });
  let imp;
  await t('Upload Excel: RG1 auto-assign, RG2 แจ้งร้านใหม่', async () => {
    const r = await api(sup.token, '/rg/import', { method: 'POST', ...upload(makeSummaryXlsx(), 'test.xlsx') });
    imp = r.body;
    assert.equal(r.status, 200, JSON.stringify(imp));
    assert.equal(imp.auto_assigned, 1, 'auto_assigned=' + imp.auto_assigned);
    assert.equal(imp.waiting_assignment, 1, 'waiting=' + imp.waiting_assignment);
    assert.ok(imp.new_shops.some((n) => n.ship_to_code === 'TNEW'), 'new_shops: ' + JSON.stringify(imp.new_shops));
  });
  await t('RG2 ค้างหน้ารอจัดพื้นที่', async () => {
    const r = await api(sup.token, '/orders/unassigned?q=999-2026');
    assert.ok(r.body.data.some((o) => o.rg_no === RG2), JSON.stringify(r.body.data?.map((o) => o.rg_no)));
    assert.ok(!r.body.data.some((o) => o.rg_no === RG1), 'RG1 ไม่ควรค้าง');
  });
  await t('Re-assign หลังเพิ่มกติกาใหม่ (เขต 154 → vendor)', async () => {
    await api(sup.token, '/admin/area-rules', { method: 'POST', ...json({ rule_field: 'zone', match_value: 'T154', vendor_id: ven.user.id }) });
    // เขตใน order คือ '154' ไม่ใช่ T154 → ยังไม่ตรง
    let r = await api(sup.token, '/orders/auto-assign', { method: 'POST' });
    const stillWaiting = r.body.new_shops?.some((n) => n.ship_to_code === 'TNEW');
    assert.ok(stillWaiting, 'TNEW ควรยังค้าง: ' + JSON.stringify(r.body));
  });
  await t('assign มือ RG2 ให้ vendor', async () => {
    const r = await api(sup.token, '/orders/bulk-assign-vendor', { method: 'PUT', ...json({ rg_nos: [RG2], vendor_id: ven.user.id }) });
    assert.equal(r.body.assigned, 1, JSON.stringify(r.body));
  });

  console.log('3) สิทธิ์: vendor ห้าม assign / gr ห้ามตั้งกติกา');
  await t('vendor เรียก bulk-assign-vendor → 403', async () => {
    const r = await api(ven.token, '/orders/bulk-assign-vendor', { method: 'PUT', ...json({ rg_nos: [RG2], vendor_id: ven.user.id }) });
    assert.equal(r.status, 403, 'status=' + r.status);
  });
  await t('gr เรียก /admin/area-rules → 403', async () => {
    const r = await api(gr.token, '/admin/area-rules');
    assert.equal(r.status, 403, 'status=' + r.status);
  });

  console.log('4) Vendor: เห็นงาน + กรอกวันที่รับ/กลับคลัง');
  await t('vendor เห็นงานตัวเอง 2 ใบ สถานะมอบหมายแล้ว', async () => {
    const r = await api(ven.token, '/orders?q=999-2026&pageSize=50');
    const mine = r.body.data.filter((o) => [RG1, RG2].includes(o.rg_no));
    assert.equal(mine.length, 2, JSON.stringify(r.body.data?.map((o) => o.rg_no)));
    assert.ok(mine.every((o) => o.status === 'assigned_vendor'));
  });
  await t('กรอกวันรับ RG1 → received', async () => {
    const r = await api(ven.token, `/orders/${RG1}/vendor-dates`, { method: 'PUT', ...json({ received_date: '2026-07-12' }) });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const o = await api(ven.token, '/orders?q=' + RG1);
    assert.equal(o.body.data[0].status, 'received');
  });
  await t('bulk กรอกวันรับ + วันกลับคลัง → returned', async () => {
    const r = await api(ven.token, '/orders/bulk-vendor-dates', { method: 'PUT', ...json({ rg_nos: [RG1, RG2], received_date: '2026-07-12', returned_date: '2026-07-14' }) });
    assert.equal(r.body.updated, 2, JSON.stringify(r.body));
    const o = await api(ven.token, '/orders?q=999-2026&pageSize=50');
    assert.ok(o.body.data.filter((x) => [RG1, RG2].includes(x.rg_no)).every((x) => x.status === 'returned'));
  });
  await t('ดาวน์โหลด template Excel รวมวันที่ + หมวด/เหตุผล ในไฟล์เดียว', async () => {
    const r = await api(ven.token, '/orders/vendor-template');
    assert.equal(r.status, 200);
    const wb = xlsx.read(Buffer.from(r.body), { type: 'buffer' });
    const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    assert.ok(rows.some((x) => x['เลขที่ RG'] === RG1));
    assert.ok('วันที่กลับคลัง (dd/mm/yyyy)' in rows[0]);
    assert.ok('หมวด' in rows[0] && 'เหตุผล' in rows[0]);
  });
  await t('bulk บันทึกหมวด+เหตุผล ทีละหลายใบ', async () => {
    const r = await api(ven.token, '/orders/bulk-vendor-notes', { method: 'PUT', ...json({ rg_nos: [RG1, RG2], rows: [{ category: 'สินค้าชำรุด', reason: 'ทดสอบ bulk' }] }) });
    assert.equal(r.body.updated, 2, JSON.stringify(r.body));
    const n = await api(ven.token, `/orders/${RG1}/vendor-notes`);
    assert.ok(n.body.some((x) => x.reason === 'ทดสอบ bulk'), JSON.stringify(n.body));
  });
  await t('bulk หมวด+เหตุผล: เลือกหมวดแล้วไม่กรอกเหตุผล → 400', async () => {
    const r = await api(ven.token, '/orders/bulk-vendor-notes', { method: 'PUT', ...json({ rg_nos: [RG1], rows: [{ category: 'สินค้าชำรุด', reason: '' }] }) });
    assert.equal(r.status, 400, JSON.stringify(r.body));
  });

  console.log('5) GR: Upload ReportRG → ปิดงานตามวันที่สร้าง Doc. WH');
  await t('gr-import ปิดงาน 2 ใบ', async () => {
    const r = await api(gr.token, '/orders/gr-import', { method: 'POST', ...upload(makeReportRGXlsx(), 'ReportRG-test.xlsx') });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.completed, 2, JSON.stringify(r.body));
  });
  await t('สถานะเป็น completed + มี completed_date/doc_wh', async () => {
    const { data } = await supabase.from('rg_headers').select('rg_no, status, completed_date, doc_wh').in('rg_no', [RG1, RG2]);
    assert.ok(data.every((o) => o.status === 'completed'), JSON.stringify(data));
    const o1 = data.find((o) => o.rg_no === RG1);
    assert.equal(o1.completed_date, '2026-07-10');
    assert.equal(o1.doc_wh, 'DOC-T1');
  });
  await t('vendor แก้วันที่หลังปิดงาน → ถูกปฏิเสธ', async () => {
    const r = await api(ven.token, `/orders/${RG1}/vendor-dates`, { method: 'PUT', ...json({ received_date: '2026-07-13' }) });
    assert.equal(r.status, 400, 'status=' + r.status);
  });
  await t('upload ซ้ำ → already_completed=2 ไม่ปิดซ้ำ', async () => {
    const r = await api(gr.token, '/orders/gr-import', { method: 'POST', ...upload(makeReportRGXlsx(), 'ReportRG-test.xlsx') });
    assert.equal(r.body.already_completed, 2, JSON.stringify(r.body));
  });

  console.log('6) KPI');
  await t('supervisor เห็นสรุป KPI ของ t_vendor ครบ 3 ช่วง', async () => {
    const r = await api(sup.token, '/kpi/summary');
    const v = r.body.vendors.find((x) => x.vendor_id === ven.user.id);
    assert.ok(v, JSON.stringify(r.body.vendors?.map((x) => x.vendor_name)));
    assert.equal(v.orders, 2);
    assert.equal(v.completed, 2);
    assert.ok(v.avg_assign_to_receive != null && v.avg_receive_to_return === 2, JSON.stringify(v));
  });
  await t('KPI รายออเดอร์: d2=2 (12→14), d3 ตรงวันปิดงาน', async () => {
    const r = await api(sup.token, '/kpi/orders?vendor_id=' + ven.user.id);
    const o1 = r.body.find((x) => x.rg_no === RG1);
    assert.equal(o1.d2, 2, JSON.stringify(o1));
    assert.equal(o1.d3, -2, 'd3 (ปิด 10 ก.ค. รับ 12 ก.ค. = -2): ' + JSON.stringify(o1));
  });
  await t('vendor เห็น KPI เฉพาะของตัวเอง', async () => {
    const r = await api(ven.token, '/kpi/summary');
    assert.ok(r.body.vendors.every((x) => x.vendor_id === ven.user.id), JSON.stringify(r.body.vendors));
  });
  await t('KPI export .xlsx ได้', async () => {
    const r = await api(sup.token, '/kpi/export?type=summary');
    assert.equal(r.status, 200);
    const wb = xlsx.read(Buffer.from(r.body), { type: 'buffer' });
    assert.ok(xlsx.utils.sheet_to_json(wb.Sheets.KPI).length >= 1);
  });

  console.log('7) Dashboard');
  await t('summary นับสถานะใหม่ (returned/completed)', async () => {
    const r = await api(sup.token, '/dashboard/summary');
    assert.ok('returned' in r.body.counts, JSON.stringify(r.body.counts));
    assert.ok(r.body.counts.completed >= 2);
  });
} finally {
  await cleanup();
}

console.log(`\nสรุป integration: ผ่าน ${pass} / ล้มเหลว ${fail}`);
process.exit(fail ? 1 : 0);
