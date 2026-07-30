import xlsx from 'xlsx';
import { parseReasonNote } from './reasons.js';

// Parse a date cell that may be an Excel serial, a Date, "dd/mm/yyyy",
// "dd.mm.yyyy", ISO "yyyy-mm-dd", or a 2-digit year -> ISO yyyy-mm-dd or null
export function toISODate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v)) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  if (typeof v === 'number') {
    const d = xlsx.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  // ISO first: yyyy-mm-dd (หรือ yyyy/mm/dd) — ปีขึ้นก่อน
  const iso = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  // dd/mm/yy(yy) — รองรับปี 2 หรือ 4 หลัก
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (m) {
    let [, dd, mm, yy] = m;
    if (yy.length === 2) yy = String(2000 + Number(yy)); // 24 -> 2024
    if (Number(yy) > 2400) yy = String(Number(yy) - 543); // พ.ศ. -> ค.ศ.
    return `${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  return null;
}

// รายชื่อ 77 จังหวัด — ใช้เทียบซ่อมชื่อที่โดนตัดท้าย (ที่อยู่ในรายงานถูก truncate บ่อย)
const PROVINCES = [
  'กรุงเทพมหานคร','กระบี่','กาญจนบุรี','กาฬสินธุ์','กำแพงเพชร','ขอนแก่น','จันทบุรี','ฉะเชิงเทรา','ชลบุรี','ชัยนาท',
  'ชัยภูมิ','ชุมพร','เชียงราย','เชียงใหม่','ตรัง','ตราด','ตาก','นครนายก','นครปฐม','นครพนม',
  'นครราชสีมา','นครศรีธรรมราช','นครสวรรค์','นนทบุรี','นราธิวาส','น่าน','บึงกาฬ','บุรีรัมย์','ปทุมธานี','ประจวบคีรีขันธ์',
  'ปราจีนบุรี','ปัตตานี','พระนครศรีอยุธยา','พะเยา','พังงา','พัทลุง','พิจิตร','พิษณุโลก','เพชรบุรี','เพชรบูรณ์',
  'แพร่','ภูเก็ต','มหาสารคาม','มุกดาหาร','แม่ฮ่องสอน','ยโสธร','ยะลา','ร้อยเอ็ด','ระนอง','ระยอง',
  'ราชบุรี','ลพบุรี','ลำปาง','ลำพูน','เลย','ศรีสะเกษ','สกลนคร','สงขลา','สตูล','สมุทรปราการ',
  'สมุทรสงคราม','สมุทรสาคร','สระแก้ว','สระบุรี','สิงห์บุรี','สุโขทัย','สุพรรณบุรี','สุราษฎร์ธานี','สุรินทร์','หนองคาย',
  'หนองบัวลำภู','อ่างทอง','อำนาจเจริญ','อุดรธานี','อุตรดิตถ์','อุทัยธานี','อุบลราชธานี',
];
// ซ่อมชื่อจังหวัด: ตรงตัว → ขึ้นต้นด้วยชื่อที่แกะได้ (โดนตัดท้าย) → เทียบตัวอักษรต่างกันเล็กน้อย (สะกดเพี้ยน เช่น ฏ/ฎ)
function normalizeProvince(name) {
  if (!name) return null;
  if (PROVINCES.includes(name)) return name;
  const pre = PROVINCES.filter((p) => p.startsWith(name) || name.startsWith(p));
  if (pre.length === 1) return pre[0];
  const close = PROVINCES.find((p) => p.length === name.length
    && [...p].filter((c, i) => c !== name[i]).length <= 1);
  return close || name;
}

// รหัสไปรษณีย์ 2 หลักแรก → จังหวัด (หลักการเดียวกับฐานข้อมูล jquery.Thailand.js แต่ฝังเฉพาะระดับจังหวัด)
const ZIP2PROVINCE = {
  10: 'กรุงเทพมหานคร', 11: 'นนทบุรี', 12: 'ปทุมธานี', 13: 'พระนครศรีอยุธยา', 14: 'อ่างทอง',
  15: 'ลพบุรี', 16: 'สิงห์บุรี', 17: 'ชัยนาท', 18: 'สระบุรี', 20: 'ชลบุรี', 21: 'ระยอง',
  22: 'จันทบุรี', 23: 'ตราด', 24: 'ฉะเชิงเทรา', 25: 'ปราจีนบุรี', 26: 'นครนายก', 27: 'สระแก้ว',
  30: 'นครราชสีมา', 31: 'บุรีรัมย์', 32: 'สุรินทร์', 33: 'ศรีสะเกษ', 34: 'อุบลราชธานี',
  35: 'ยโสธร', 36: 'ชัยภูมิ', 37: 'อำนาจเจริญ', 38: 'บึงกาฬ', 39: 'หนองบัวลำภู',
  40: 'ขอนแก่น', 41: 'อุดรธานี', 42: 'เลย', 43: 'หนองคาย', 44: 'มหาสารคาม', 45: 'ร้อยเอ็ด',
  46: 'กาฬสินธุ์', 47: 'สกลนคร', 48: 'นครพนม', 49: 'มุกดาหาร', 50: 'เชียงใหม่', 51: 'ลำพูน',
  52: 'ลำปาง', 53: 'อุตรดิตถ์', 54: 'แพร่', 55: 'น่าน', 56: 'พะเยา', 57: 'เชียงราย', 58: 'แม่ฮ่องสอน',
  60: 'นครสวรรค์', 61: 'อุทัยธานี', 62: 'กำแพงเพชร', 63: 'ตาก', 64: 'สุโขทัย', 65: 'พิษณุโลก',
  66: 'พิจิตร', 67: 'เพชรบูรณ์', 70: 'ราชบุรี', 71: 'กาญจนบุรี', 72: 'สุพรรณบุรี', 73: 'นครปฐม',
  74: 'สมุทรสาคร', 75: 'สมุทรสงคราม', 76: 'เพชรบุรี', 77: 'ประจวบคีรีขันธ์', 80: 'นครศรีธรรมราช',
  81: 'กระบี่', 82: 'พังงา', 83: 'ภูเก็ต', 84: 'สุราษฎร์ธานี', 85: 'ระนอง', 86: 'ชุมพร',
  90: 'สงขลา', 91: 'สตูล', 92: 'ตรัง', 93: 'พัทลุง', 94: 'ปัตตานี', 95: 'ยะลา', 96: 'นราธิวาส',
};
// ยกเว้น: สมุทรปราการใช้ 10xxx ร่วมกับกรุงเทพ — ระบุรายรหัส
const SAMUT_PRAKAN_ZIPS = new Set(['10130', '10270', '10280', '10290', '10540', '10550', '10560']);

function zipToProvince(s) {
  const m = String(s || '').match(/\b(\d{5})\b(?!.*\b\d{5}\b)/); // เลข 5 หลักตัวท้ายสุดของที่อยู่
  if (!m) return null;
  const zip = m[1];
  if (SAMUT_PRAKAN_ZIPS.has(zip)) return 'สมุทรปราการ';
  return ZIP2PROVINCE[Number(zip.slice(0, 2))] || null;
}

// แกะ อำเภอ/จังหวัด จากที่อยู่ Ship To (เช่น "ต.บางม่วง อ.บางใหญ่ จ.นนทบุรี 11140" / "เขตคลองเตย กรุงเทพฯ")
export function parseAddress(shipToName) {
  const s = String(shipToName || '');
  let district = null, province = null;
  const d = s.match(/(?:อ\.|อำเภอ\s*)([ก-๙]+)/) || s.match(/(?:เขต\s*)([ก-๙]+)/);
  if (d) district = d[1].trim();
  // ลำดับความแม่น: รหัสไปรษณีย์ → ข้อความ "จ./จังหวัด" → รูปแบบที่อยู่กรุงเทพ (แขวง/กทม)
  province = zipToProvince(s);
  if (!province) {
    const p = s.match(/(?:จ\.|จังหวัด\s*)([ก-๙]{2,})/); // ≥2 ตัวอักษร กันที่อยู่โดนตัดท้าย เช่น "จ.ก"
    if (p) province = normalizeProvince(p[1].trim());
    else if (/กรุงเทพฯ?|กทม|แขวง/.test(s)) province = 'กรุงเทพมหานคร'; // แขวง/เขต = รูปแบบที่อยู่กรุงเทพ
  }
  return { district, province };
}

const num = (v) => {
  const n = parseInt(String(v ?? '').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
};

// Detect which report we're looking at by scanning first rows for known headers.
function detectFormat(rows) {
  for (const row of rows.slice(0, 4)) {
    const joined = row.map((c) => String(c ?? '')).join('|');
    if (/Sold To Code/i.test(joined) && /Ship To Code/i.test(joined)) return 'summary';
    // Close report (รูปแบบปิดงานใหม่): มีหัว "ว.ด.ปี ที่ Complete"
    if (/ว\.?ด\.?ปี.*Complete/i.test(joined)) return 'close';
  }
  // detail report: has "Invoice" and item-level good/damaged columns
  const first = rows[0]?.map((c) => String(c ?? '')).join('|') || '';
  if (/Invoice/i.test(first)) return 'detail';
  return 'summary';
}

// SUMMARY: map คอลัมน์ตาม "ชื่อหัวตาราง" ในไฟล์จริง (ไม่ fix ตำแหน่ง — กันไฟล์เรียงคอลัมน์ไม่ตรงกับที่คาด)
// ตัวอย่างหัว: เขต | เลขที่ RG | Sold To Code | Sold To Name | Ship To Code | Ship To Name |
// จำนวนกล่อง | จำนวนชิ้น | หมายเหตุ | วันที่ | Sales Org | Sold To
function parseSummary(rows) {
  const hi = rows.findIndex((r) => r.some((c) => /Sold To Code/i.test(String(c ?? ''))));
  const start = hi < 0 ? 1 : hi + 1;

  // สร้าง map: ชื่อหัว (normalize) → index
  const findCol = (labels, fallback) => {
    if (hi < 0) return fallback;
    const hdr = rows[hi].map((c) => String(c ?? '').trim().toLowerCase().replace(/\s+/g, ' '));
    for (const re of labels) {
      const idx = hdr.findIndex((h) => re.test(h));
      if (idx >= 0) return idx;
    }
    return fallback;
  };
  const C = {
    zone: findCol([/^เขต$/, /^zone$/], 0),
    rg_no: findCol([/เลขที่ rg/, /^rg no/], 1),
    sold_to_code: findCol([/^sold to code$/], 2),
    // "Sold To" (เดี่ยวๆ ท้ายรายงาน) = รหัสลูกค้า ใช้จับคู่ Vendor; "Sold To Name" = ชื่อร้าน
    // บางรายงานสองคอลัมน์นี้สลับกัน → ตอนอ่านรายแถวจะเลือกฝั่งที่เป็นตัวเลขเข้า sold_to
    sold_to: findCol([/^sold to$/], 11),
    sold_to_name: findCol([/^sold to name$/], 3),
    ship_to_code: findCol([/^ship to code$/], 4),
    ship_to_name: findCol([/^ship to name$/, /^ship to$/], 5),
    qty_boxes: findCol([/กล่อง/, /box/], 6),
    qty_pieces: findCol([/ชิ้น/, /piece/], 7),
    note: findCol([/หมายเหตุ/, /remark/], 8),
    rg_date: findCol([/^วันที่พิมพ์$/, /^วันที่$/, /^date$/], 9),
    sales_org: findCol([/sales org/], 10),
    // คอลัมน์พื้นที่ในไฟล์ใหม่ (ถ้าไม่มี = -1 → fallback ไปแกะจากที่อยู่)
    district: findCol([/^district$/, /^อำเภอ$/], -1),
    province: findCol([/^province$/, /^จังหวัด$/], -1),
    region: findCol([/^region$/, /^ภูมิภาค$/], -1),
  };
  const cell = (r, i) => (i >= 0 ? String(r[i] ?? '').trim() : '');

  const headers = [];
  for (const r of rows.slice(start)) {
    const rgNo = String(r[C.rg_no] ?? '').trim();
    if (!/^\d{3}-\d{4}-\d{4,}$/.test(rgNo)) continue; // valid RG number pattern
    const rn = parseReasonNote(r[C.note]);
    const addr = parseAddress(r[C.ship_to_name]);
    // sold_to = รหัสลูกค้า (ตัวเลข), sold_to_name = ชื่อร้าน — สลับให้ถ้ารายงานเรียงคอลัมน์กลับกัน
    const isCode = (s) => /^\d+$/.test(s);
    let soldTo = String(r[C.sold_to] ?? '').trim();
    let soldToName = String(r[C.sold_to_name] ?? '').trim();
    if (!isCode(soldTo) && isCode(soldToName)) [soldTo, soldToName] = [soldToName, soldTo];
    // พื้นที่: ใช้ค่าจากคอลัมน์ในไฟล์ก่อน (ตรงต้นฉบับ) — ไม่มีค่อย fallback ไปแกะจากที่อยู่
    const district = cell(r, C.district) || addr.district;
    const province = cell(r, C.province) || addr.province;
    const region = cell(r, C.region) || null;
    headers.push({
      district,
      province,
      region,
      rg_no: rgNo,
      zone: String(r[C.zone] ?? '').trim() || null,
      sold_to_code: String(r[C.sold_to_code] ?? '').trim() || null,
      sold_to: soldTo || null,
      sold_to_name: soldToName || null,
      ship_to_code: String(r[C.ship_to_code] ?? '').trim() || null,
      ship_to_name: String(r[C.ship_to_name] ?? '').trim() || null,
      qty_boxes: num(r[C.qty_boxes]),
      qty_pieces: num(r[C.qty_pieces]),
      reason_note: rn.reason_note,
      wh_code: rn.wh_code,
      reason_code: rn.reason_code,
      reason_text: rn.reason_text,
      reference: rn.reference,
      rg_date: toISODate(r[C.rg_date]),
      sales_org: String(r[C.sales_org] ?? '').trim() || null
    });
  }
  return { headers, items: [], completions: [] };
}

// DETAIL: วันที่ | รหัสร้าน | ชื่อร้าน | จังหวัด | รหัสสินค้า | ชื่อสินค้า | ดี | เสีย |
// Invoice | เหตุผล CN | เลขที่ RG | Doc WH | วันที่ Doc WH | ประเภท | จำนวนเงิน
function parseDetail(rows) {
  const items = [];
  // เลขที่ RG → { doc_wh, completed_date, remark } จากคอลัมน์ Doc. WH / วันที่สร้าง Doc. WH
  // มีวันที่ = สินค้ารับเข้าคลังแล้ว → ใช้ปิดงาน (GR upload)
  // Remark หาจากชื่อหัวคอลัมน์ (ไฟล์นี้คอลัมน์อื่นอ่านตามตำแหน่ง แต่ Remark อาจไม่มี/อยู่ท้ายสุด)
  const hdr0 = (rows[0] || []).map((c) => String(c ?? '').trim().toLowerCase());
  const cRemark = hdr0.findIndex((h) => /remark|หมายเหตุ/.test(h));
  const completions = new Map();
  for (const r of rows.slice(1)) {
    const rgNo = String(r[10] ?? '').trim();
    if (!/^\d{3}-\d{4}-\d{4,}$/.test(rgNo)) continue;
    items.push({
      rg_no: rgNo,
      product_code: String(r[4] ?? '').trim() || null,
      product_name: String(r[5] ?? '').trim() || null,
      qty_good: num(r[6]),
      qty_damaged: num(r[7]),
      invoice_no: String(r[8] ?? '').trim() || null
    });
    const docDate = toISODate(r[12]);
    if (docDate) {
      const remark = cRemark < 0 ? '' : String(r[cRemark] ?? '').trim();
      const prev = completions.get(rgNo);
      completions.set(rgNo, {
        doc_wh: String(r[11] ?? '').trim() || null,
        completed_date: docDate,
        remark: prev?.remark || remark || null,
      });
    }
  }
  return { headers: [], items, completions: [...completions.entries()].map(([rg_no, c]) => ({ rg_no, ...c })) };
}

// CLOSE (รูปแบบปิดงานใหม่): ว.ด.ปี ที่ Complete | ว.ด.ปี ที่ Key | เลขที่ RG | เขต |
//   รหัสร้านค้า | ชื่อร้านค้า | รหัสสินค้า | ชื่อสินค้า | จำนวนดี (ชิ้น) | จำนวนเสีย (ชิ้น)
//   จับคู่ด้วยเลขที่ RG · วันปิดงาน = "ว.ด.ปี ที่ Complete" (ไม่มี Doc. WH ในไฟล์นี้)
function parseClose(rows) {
  const hi = rows.findIndex((r) => r.some((c) => /เลขที่\s*RG/i.test(String(c ?? ''))));
  if (hi < 0) return { headers: [], items: [], completions: [] };
  const hdr = rows[hi].map((c) => String(c ?? '').trim().toLowerCase().replace(/\s+/g, ' '));
  const col = (re, fallback) => { const i = hdr.findIndex((h) => re.test(h)); return i < 0 ? fallback : i; };
  const cComplete = col(/complete/, 0);
  const cRg = col(/เลขที่ rg/, 2);
  const cProdCode = col(/รหัสสินค้า/, 6);
  const cProdName = col(/ชื่อสินค้า/, 7);
  const cGood = col(/จำนวนดี|ดี \(ชิ้น\)|^ดี/, 8);
  const cDamaged = col(/จำนวนเสีย|เสีย \(ชิ้น\)|^เสีย/, 9);
  const cRemark = col(/remark|หมายเหตุ/, -1); // ไม่มีคอลัมน์นี้ก็ได้ (-1 = ไม่อ่าน)

  const items = [];
  const completions = new Map(); // rgNo -> { completed_date } (เอาค่าล่าสุดต่อ RG)
  for (const r of rows.slice(hi + 1)) {
    const rgNo = String(r[cRg] ?? '').trim();
    if (!/^\d{3}-\d{4}-\d{4,}$/.test(rgNo)) continue;
    items.push({
      rg_no: rgNo,
      product_code: String(r[cProdCode] ?? '').trim() || null,
      product_name: String(r[cProdName] ?? '').trim() || null,
      qty_good: num(r[cGood]),
      qty_damaged: num(r[cDamaged]),
      invoice_no: null,
    });
    const doneDate = toISODate(r[cComplete]);
    // Remark: RG ใบเดียวแตกได้หลายแถว — เก็บ remark แถวแรกที่มีค่า (แถวอื่นมักเว้นว่าง)
    const remark = cRemark < 0 ? '' : String(r[cRemark] ?? '').trim();
    if (doneDate) {
      const prev = completions.get(rgNo);
      completions.set(rgNo, { doc_wh: null, completed_date: doneDate, remark: prev?.remark || remark || null });
    }
  }
  return { headers: [], items, completions: [...completions.entries()].map(([rg_no, c]) => ({ rg_no, ...c })) };
}

export function parseWorkbook(buffer) {
  const wb = xlsx.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
  const fmt = detectFormat(rows);
  const parsed = fmt === 'detail' ? parseDetail(rows)
    : fmt === 'close' ? parseClose(rows)
    : parseSummary(rows);
  return { format: fmt, ...parsed };
}
