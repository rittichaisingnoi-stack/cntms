import { supabase } from './supabase.js';

// เงื่อนไขที่ใช้จับคู่ Vendor — ระบบไล่จาก "เจาะจงที่สุด → กว้างที่สุด" ตามลำดับนี้เสมอ
// (ค่าใน rg_headers: sold_to = Ship To (ปลายทาง) → sold_to_code → zone (เขต) → region (ภูมิภาค))
export const RULE_FIELDS = {
  sold_to: 'Ship To (ปลายทาง)',
  sold_to_code: 'Sold To Code',
  zone: 'เขต',
  region: 'Region (ภูมิภาค)',
};
export const FIELD_ORDER = ['sold_to', 'sold_to_code', 'zone', 'region'];

// Priority ตายตัวตามความเจาะจงของ field — user ไม่ต้องกรอกเอง
export const FIELD_PRIORITY = { sold_to: 1, sold_to_code: 2, zone: 3, region: 4 };

export async function loadRules() {
  const { data, error } = await supabase
    .from('area_rules').select('*').eq('enabled', true).order('priority').order('id');
  if (error) throw error;
  return data || [];
}

const norm = (v) => String(v ?? '').trim().toLowerCase();

// หา vendor ของ order: ไล่ field ตาม FIELD_ORDER แล้วหา rule แรกที่ค่าตรงและมี vendor_id
export function resolveVendor(header, rules) {
  for (const field of FIELD_ORDER) {
    const v = norm(header[field]);
    if (!v) continue;
    const rule = rules.find((r) => r.vendor_id && r.rule_field === field && norm(r.match_value) === v);
    if (rule) return rule;
  }
  return null;
}

// Auto-assign order ที่ยัง pending ให้ Vendor ตามกติกา
// rgNos: จำกัดเฉพาะชุดนี้ (เช่นหลัง import) หรือ null = pending ทั้งหมด (ปุ่ม Re-assign)
// คืน { assigned, waiting, newShops } — newShops = ร้านที่ไม่ตรงกติกาใดเลย
export async function autoAssignPending({ rgNos = null, actionBy = null } = {}) {
  let rules = [];
  try { rules = await loadRules(); } catch { /* ตาราง rules ยังไม่มี */ }

  // เลือกคอลัมน์ + region (ถ้ายังไม่ได้รัน region.sql ให้ถอย select แบบไม่มี region)
  const baseCols = 'rg_no, ship_to_code, sold_to, sold_to_code, zone, sold_to_name, ship_to_name';
  const run = (cols) => {
    let q = supabase.from('rg_headers').select(cols).eq('status', 'pending');
    if (rgNos) q = q.in('rg_no', rgNos);
    return q;
  };
  let { data: pend, error } = await run(baseCols + ', region');
  if (error) ({ data: pend, error } = await run(baseCols)); // fallback: column region ยังไม่มี
  if (error) throw error;

  let assigned = 0, waiting = 0;
  const newShops = new Map();
  for (const h of pend || []) {
    const rule = rules.length ? resolveVendor(h, rules) : null;
    if (!rule) {
      waiting++;
      // สรุปเป็นราย Sold To Code (ร้านเดียวมีได้หลายสาขา/หลายออเดอร์) พร้อมนับจำนวนออเดอร์ที่ค้าง
      const key = h.sold_to_code || h.sold_to || h.ship_to_code || h.rg_no;
      const cur = newShops.get(key);
      if (!cur) {
        newShops.set(key, {
          sold_to_code: h.sold_to_code, sold_to_name: h.sold_to_name,
          orders: 1,
          shipTos: new Set([h.ship_to_code].filter(Boolean)),
          zones: new Set([h.zone].filter(Boolean)),
        });
      } else {
        cur.orders++;
        if (h.ship_to_code) cur.shipTos.add(h.ship_to_code);
        if (h.zone) cur.zones.add(h.zone);
      }
      continue;
    }
    const patch = {
      vendor_id: rule.vendor_id, area: rule.area || null,
      status: 'assigned_vendor', assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (actionBy != null) patch.admin_id = actionBy; // ผู้ที่ทำให้เกิดการมอบหมาย (ผู้ Upload/กด Re-assign)
    const { error: ue } = await supabase.from('rg_headers')
      .update(patch)
      .eq('rg_no', h.rg_no).eq('status', 'pending');
    if (ue) { waiting++; continue; }
    assigned++;
    await supabase.from('order_tracking').insert({
      rg_no: h.rg_no, status: 'assigned_vendor', action_by: actionBy,
      note: `auto-assign ตามกติกา (${rule.rule_field} = ${rule.match_value})`,
    });
  }
  // เรียงจากร้านที่ค้างเยอะสุด — จะได้ไปเพิ่มกติกาให้ร้านที่มีผลมากที่สุดก่อน
  const shops = [...newShops.values()]
    .sort((a, b) => b.orders - a.orders)
    .map((s) => ({
      sold_to_code: s.sold_to_code, sold_to_name: s.sold_to_name,
      zone: [...s.zones][0] || null, zone_count: s.zones.size,
      orders: s.orders, branches: s.shipTos.size,
    }));
  return { assigned, waiting, newShops: shops.slice(0, 50), newShopsTotal: shops.length };
}
