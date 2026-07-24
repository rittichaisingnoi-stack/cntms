// ค้นหาออเดอร์ — ใช้ร่วมกันทุก route (ตาราง/Export) เพื่อให้ผลลัพธ์ตรงกันเสมอ
//   คั่นด้วย , = OR ระหว่างกลุ่ม · เว้นวรรคในกลุ่ม = AND
//   แต่ละคำค้นในคอลัมน์: เลขที่ RG / Sold To Code / ร้านค้า / อำเภอ / จังหวัด (OR กัน)
export const SEARCH_COLS = ['rg_no', 'sold_to_code', 'sold_to_name', 'district', 'province'];

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
