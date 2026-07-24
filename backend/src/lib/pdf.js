import PDFDocument from 'pdfkit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT = path.join(__dirname, '../assets/fonts/tahoma.ttf');
const FONT_BOLD = path.join(__dirname, '../assets/fonts/tahomabd.ttf');

function newDoc() {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  doc.registerFont('th', FONT);
  doc.registerFont('th-bold', FONT_BOLD);
  doc.font('th');
  return doc;
}

const thaiDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

// -------- Form 1: ใบแจ้งให้ขนส่งไปรับคืนสินค้า (FORM_WH) --------
export function transportFormPDF(rg) {
  const doc = newDoc();
  const L = 40, R = 555;

  doc.font('th-bold').fontSize(9).fillColor('#c00')
    .text('NEO CORPORATE PUBLIC COMPANY LIMITED', L, 40);
  doc.fillColor('#000').fontSize(9)
    .text(`วัน เดือน ปี  ${thaiDate(rg.rg_date)}`, 350, 40, { width: 205, align: 'right' })
    .text(`เอกสารอ้างอิง / ใบ RG  ${rg.rg_no}`, 350, 55, { width: 205, align: 'right' });

  doc.font('th-bold').fontSize(16)
    .text('ใบแจ้งให้ขนส่งไปรับคืนสินค้า ทุกช่องทางขาย', L, 85, { width: R - L, align: 'center' });

  doc.moveTo(L, 115).lineTo(R, 115).stroke();

  let y = 130;
  doc.font('th-bold').fontSize(10);
  doc.text('ชื่อร้านค้า', L, y);
  doc.font('th').text(rg.sold_to_name || '', L + 60, y, { width: 200 });
  doc.font('th-bold').text('อำเภอ', 300, y);
  doc.font('th').text(rg.district || '', 340, y, { width: 90 });
  doc.font('th-bold').text('จังหวัด', 440, y);
  doc.font('th').text(rg.province || '', 485, y, { width: 70 });

  y += 30;
  doc.font('th-bold').text('ติดต่อคุณ', L, y);
  doc.font('th').text(rg.contact_name || '', L + 60, y, { width: 200 });
  doc.font('th-bold').text('เบอร์โทรศัพท์', 340, y);
  doc.font('th').text(rg.contact_phone || '', 420, y, { width: 130 });

  y += 20;
  doc.font('th-bold').text('เบอร์โทรฝ่ายขาย', L, y);
  doc.font('th').text(rg.sales_person || '', L + 95, y, { width: 300 });

  // จำนวนสินค้า box
  y += 30;
  doc.rect(L, y, R - L, 55).stroke();
  doc.font('th-bold').fontSize(18)
    .text('จำนวนสินค้า', L + 40, y + 16);
  doc.fontSize(16).text(String(rg.qty_boxes ?? 0), L + 230, y + 18, { width: 90, align: 'center' });
  doc.fontSize(18).text('กล่อง', L + 360, y + 16);

  // หมายเหตุ box
  y += 75;
  doc.rect(L, y, R - L, 70).stroke();
  doc.font('th-bold').fontSize(11).text('หมายเหตุ :', L + 15, y + 10);
  const note = `(WH:${rg.wh_code || ''}) (เหตุผล:${rg.reason_code || ''} : ${rg.reason_text || ''})`;
  doc.font('th').fontSize(10).text(note, L + 25, y + 28, { width: R - L - 50 });

  // signature blocks
  y += 95;
  doc.rect(L, y, 250, 70).stroke();
  doc.rect(305, y, 250, 70).stroke();
  doc.font('th-bold').fontSize(11)
    .text('สำหรับร้านค้า', L, y + 8, { width: 250, align: 'center' })
    .text('สำหรับขนส่ง', 305, y + 8, { width: 250, align: 'center' });
  doc.font('th').fontSize(9)
    .text('.................................................', L, y + 32, { width: 250, align: 'center' })
    .text('วันที่.......เดือน.........พ.ศ.........', L, y + 48, { width: 250, align: 'center' });
  doc.text('ชื่อ - นามสกุล ...............................', 320, y + 32)
    .text('ทะเบียนรถ ...................................', 320, y + 50);

  y += 90;
  doc.rect(155, y, 250, 70).stroke();
  doc.font('th-bold').fontSize(11).text('ผู้รับคืนสินค้า ( คลังสินค้า )', 155, y + 10, { width: 250, align: 'center' });
  doc.font('th').fontSize(9)
    .text('.................................................', 155, y + 34, { width: 250, align: 'center' })
    .text('วันที่.......เดือน.........พ.ศ.........', 155, y + 50, { width: 250, align: 'center' });

  y += 90;
  doc.fontSize(8).fillColor('#000');
  const notes = [
    'หมายเหตุ : 1. สินค้าที่คืนจะต้องอยู่ในกล่อง ที่ติด TAG แล้วเท่านั้น',
    '2. ขนส่งนับจำนวนกล่องเท่านั้น (ไม่แกะนับสินค้าในกล่อง)',
    '3. เอกสาร 1 ชุด มี 3 ใบ 1.ให้ร้านค้า 2.คืนให้คลังสินค้า พร้อมคืนของ 3.ขนส่งเก็บไว้คิดค่าขนส่ง',
    '4. MT SPC ให้ขนส่งถ่ายรูปจำนวนกล่อง ที่ได้รับคืน แล้ว Print รูปแนบใบรับคืนก่อนคืนสินค้าให้ WH'
  ];
  notes.forEach((n, i) => doc.text(n, i === 0 ? L : L + 55, y + i * 13, { width: R - L }));

  doc.end();
  return doc;
}

// -------- Form 2: เอกสารแทนใบรับคืนสินค้า (RG detail / receipt) --------
export function receiptFormPDF(rg) {
  const doc = newDoc();
  const L = 40, R = 555;

  doc.font('th-bold').fontSize(9).fillColor('#c00')
    .text('NEO CORPORATE PUBLIC COMPANY LIMITED', L, 40);
  doc.fillColor('#000').font('th-bold').fontSize(14)
    .text('เอกสารแทนใบรับคืนสินค้า', 300, 40, { width: 255, align: 'right' });

  // customer info box
  let y = 70;
  doc.rect(L, y, R - L, 90).stroke();
  doc.moveTo(300, y).lineTo(300, y + 90).stroke();
  doc.font('th-bold').fontSize(9);
  doc.text('เลขที่อ้างอิง :', 305, y + 6);
  doc.font('th').text(rg.rg_no, 380, y + 6);
  doc.font('th-bold').text('ชื่อลูกค้า :', 305, y + 24);
  doc.font('th').text(rg.sold_to_name || '', 380, y + 24, { width: 170 });
  doc.font('th-bold').text('ที่อยู่ :', 305, y + 48);
  doc.font('th').text(rg.ship_to_name || '', 380, y + 48, { width: 170 });
  doc.font('th-bold').text('ผู้ติดต่อ :', 305, y + 66);
  doc.font('th').text(`${rg.contact_name || ''} ${rg.contact_phone || ''}`.trim(), 380, y + 66, { width: 170 });

  // items table
  y += 105;
  const cols = [
    { t: 'ลำดับที่', x: L, w: 45 },
    { t: 'รหัสสินค้า', x: L + 45, w: 70 },
    { t: 'ชื่อสินค้า', x: L + 115, w: 230 },
    { t: 'ดี(ชิ้น)', x: L + 345, w: 55 },
    { t: 'เสีย(ชิ้น)', x: L + 400, w: 55 },
    { t: 'รวม(ชิ้น)', x: L + 455, w: 60 }
  ];
  doc.font('th-bold').fontSize(9);
  const headH = 18;
  cols.forEach((c) => {
    doc.rect(c.x, y, c.w, headH).stroke();
    doc.text(c.t, c.x, y + 5, { width: c.w, align: 'center' });
  });

  doc.font('th').fontSize(9);
  let ry = y + headH;
  const items = rg.items || [];
  let tGood = 0, tDmg = 0;
  items.forEach((it, i) => {
    const rowH = 16;
    const total = (it.qty_good || 0) + (it.qty_damaged || 0);
    tGood += it.qty_good || 0; tDmg += it.qty_damaged || 0;
    const vals = [String(i + 1), it.product_code || '', it.product_name || '',
      String(it.qty_good || 0), String(it.qty_damaged || 0), String(total)];
    cols.forEach((c, ci) => {
      doc.rect(c.x, ry, c.w, rowH).stroke();
      doc.text(vals[ci], c.x + 3, ry + 4, { width: c.w - 6, align: ci === 2 ? 'left' : 'center' });
    });
    ry += rowH;
  });
  // total row
  doc.font('th-bold');
  const totRow = ['', '', 'รวม', String(tGood), String(tDmg), String(tGood + tDmg)];
  cols.forEach((c, ci) => {
    doc.rect(c.x, ry, c.w, 18).stroke();
    doc.text(totRow[ci], c.x + 3, ry + 5, { width: c.w - 6, align: ci === 2 ? 'right' : 'center' });
  });

  // signatures
  let sy = ry + 50;
  doc.font('th').fontSize(10);
  [['ลงชื่อผู้คืน', '/วดป'], ['ลงชื่อผู้รับคืน', '/วดป'], ['ลงชื่อโกดัง', '/วดป'], ['ทะเบียนรถ', 'ผู้รับคืนสินค้า']]
    .forEach(([a, b], i) => {
      doc.text(a, 340, sy + i * 26);
      doc.text('..............................', 410, sy + i * 26);
      doc.text(b, 500, sy + i * 26);
    });

  doc.fontSize(8).text(`Print ${new Date().toLocaleString('th-TH')}   *** 1 / 1 ***`, L, sy + 120);
  doc.end();
  return doc;
}
