// เหตุผลการคืนสินค้า (RG reason codes) — เท่าที่พบในเอกสาร WH08
export const REASON_MAP = {
  '05': 'สินค้าชำรุด/หมดคุณภาพ',
  '06': 'อายุ',
  '15': 'ลูกค้าลด Stock'
};

export function reasonText(code) {
  return REASON_MAP[code] || '';
}

// แยกหมายเหตุแบบ "(WH:WH08) (เหตุผล:06 : อายุ) ...อ้างอิง 4003536345" -> {wh, code, text, note, reference}
export function parseReasonNote(raw) {
  const out = { wh_code: null, reason_code: null, reason_text: null, reason_note: null, reference: null };
  if (!raw) return out;
  const note = String(raw).replace(/_x000D_/g, '').replace(/\r?\n/g, ' ').trim();
  out.reason_note = note;
  const wh = note.match(/WH\s*:\s*(WH\d+)/i);
  if (wh) out.wh_code = wh[1].toUpperCase();
  const rs = note.match(/เหตุผล\s*:\s*(\d+)/);
  if (rs) {
    out.reason_code = rs[1];
    out.reason_text = reasonText(rs[1]);
  }
  // เลขอ้างอิง เช่น "หมายเลขอ้างอิง 4003536345" / "อ้างอิง 4003546974"
  const ref = note.match(/อ้างอิง\s*:?\s*(\d{6,})/);
  if (ref) out.reference = ref[1];
  return out;
}
