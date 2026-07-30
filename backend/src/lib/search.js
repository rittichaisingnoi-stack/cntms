// ค้นหาออเดอร์ — ใช้ร่วมกันทุก route (ตาราง/Export) เพื่อให้ผลลัพธ์ตรงกันเสมอ
//   คั่นด้วย , = OR ระหว่างกลุ่ม · เว้นวรรคในกลุ่ม = AND
//   ค้นได้ทุกคอลัมน์ที่ผู้ใช้เห็นในตาราง: เลขที่ RG / เขต / Sold To Code / Ship To (sold_to) /
//   Ship To Code / ร้านค้า / ที่อยู่ส่ง / อำเภอ / จังหวัด / Region / WH / เหตุผล / หมายเลขอ้างอิง
export const SEARCH_COLS = [
  'rg_no', 'zone', 'sold_to_code', 'sold_to', 'ship_to_code', 'sold_to_name', 'ship_to_name',
  'district', 'province', 'region', 'wh_code', 'reason_text', 'reference',
];

export function applySearch(query, q) {
  if (!q || !q.trim()) return query;
  // ตัดอักขระพิเศษของ PostgREST ( , ( ) * ) ที่จะทำให้ filter string เพี้ยน
  const clean = (s) => s.replace(/[,()*]/g, ' ').trim();
  const groups = [];
  for (const part of String(q).split(',')) {
    const words = clean(part).split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    // แต่ละคำ = (col1.ilike.*w* OR col2... ) · หลายคำในกลุ่มเดียว = AND
    const wordClauses = words.map((w) => `or(${SEARCH_COLS.map((c) => `${c}.ilike.*${w}*`).join(',')})`);
    groups.push(wordClauses.length === 1 ? wordClauses[0] : `and(${wordClauses.join(',')})`);
  }
  if (!groups.length) return query;
  // .or() รับเนื้อหา "ภายใน" or(...) ชั้นบนสุด → ต่อกลุ่มด้วย , ได้เลย (แต่ละกลุ่ม OR กัน)
  return query.or(groups.join(','));
}
