import { supabase } from './supabase.js';

// กติกาเริ่มต้น Sales Org (ถ้ายังไม่ได้รัน sla_plan.sql ใน DB)
export const DEFAULT_PICKUP_RULES = [
  { sales_org: '10', sales_org_name: 'MT', days: null, is_manual: true, enabled: true },
  { sales_org: '11', sales_org_name: 'TTD', days: 1, is_manual: false, enabled: true },
  { sales_org: '12', sales_org_name: 'Van', days: 1, is_manual: false, enabled: true },
  { sales_org: '13', sales_org_name: 'Export', days: 1, is_manual: false, enabled: true },
  { sales_org: '14', sales_org_name: 'TTP', days: 1, is_manual: false, enabled: true },
  { sales_org: '15', sales_org_name: 'e-Com.', days: 1, is_manual: false, enabled: true },
  { sales_org: '16', sales_org_name: 'SPC', days: 1, is_manual: false, enabled: true },
  { sales_org: '17', sales_org_name: 'Direct Sales', days: 1, is_manual: false, enabled: true },
  { sales_org: '30', sales_org_name: 'Neo-F Sales Org.', days: 1, is_manual: false, enabled: true },
];

export const BKK_GBKK_PROVINCES = ['กรุงเทพมหานคร', 'กรุงเทพฯ', 'กทม', 'นนทบุรี', 'ปทุมธานี', 'สมุทรปราการ'];

// โหลดกติกาแผนนัดเข้ารับ (Sales Org)
export async function loadPickupRules() {
  try {
    const { data, error } = await supabase
      .from('sla_pickup_rules')
      .select('*')
      .order('id', { ascending: true });
    if (!error && data && data.length) return data;
  } catch { /* ตารางยังไม่มี fallback */ }
  return DEFAULT_PICKUP_RULES;
}

import defaultReturnRules from './defaultReturnRules.json' with { type: 'json' };
export const DEFAULT_RETURN_RULES = defaultReturnRules;

// โหลดกติกาแผนนัดส่งกลับ (Return SLA)
export async function loadReturnRules() {
  try {
    const { data, error } = await supabase
      .from('sla_return_rules')
      .select('*')
      .eq('enabled', true)
      .order('priority', { ascending: true })
      .order('id', { ascending: true });
    if (!error && data && data.length) return data;
  } catch { /* ตารางยังไม่มี fallback */ }
  return DEFAULT_RETURN_RULES;
}

const cleanStr = (s) => String(s ?? '').trim().toLowerCase();

export const cleanProvince = (p) => {
  let s = cleanStr(p);
  if (!s) return '';
  s = s.replace(/^(จ\.|จังหวัด)/, '').trim();
  if (['กทม', 'กทม.', 'กรุงเทพ', 'กรุงเทพฯ', 'กรุงเทพมหานคร'].includes(s)) return 'กรุงเทพมหานคร';
  return s;
};

// หา SLA แผนนัดเข้ารับจาก Sales Org
export function resolvePickupRule(salesOrg, rules = DEFAULT_PICKUP_RULES) {
  const code = cleanStr(salesOrg);
  if (!code) return null;
  return rules.find((r) => r.enabled !== false && cleanStr(r.sales_org) === code) || null;
}

// หา SLA แผนนัดส่งกลับ (Priority: ship_to → sold_to_code → zone → province → default)
export function resolveReturnRule(header, rules = []) {
  const shipTo = cleanStr(header.sold_to || header.ship_to_code);
  const soldToCode = cleanStr(header.sold_to_code);
  const zone = cleanStr(header.zone);
  const prov = cleanProvince(header.province);

  // 1. ตรวจ Ship To (เจาะจงสูงสุด)
  if (shipTo) {
    const r = rules.find((x) => x.rule_type === 'ship_to' && cleanStr(x.match_value) === shipTo);
    if (r) return r;
  }
  // 2. ตรวจ Sold To Code
  if (soldToCode) {
    const r = rules.find((x) => x.rule_type === 'sold_to_code' && cleanStr(x.match_value) === soldToCode);
    if (r) return r;
  }
  // 3. ตรวจ เขต (Zone)
  if (zone) {
    const r = rules.find((x) => x.rule_type === 'zone' && cleanStr(x.match_value) === zone);
    if (r) return r;
  }
  // 4. ตรวจ จังหวัด (Province)
  if (prov) {
    const r = rules.find((x) => x.rule_type === 'province' && cleanProvince(x.match_value) === prov);
    if (r) return r;
  }

  // 5. Fallback อัตโนมัติ: BKK/GBKK = 3 วัน, อื่นๆ = 30 วัน
  const isBkk = BKK_GBKK_PROVINCES.some((p) => cleanProvince(p) === prov);
  return {
    rule_type: 'default',
    match_value: prov || 'default',
    days: isBkk ? 3 : 30,
    region: isBkk ? 'BKK' : 'Upcountry',
  };
}

// บวกจำนวนวันเข้ากับวันที่ (YYYY-MM-DD)
export function addDaysToDate(dateInput, daysToAdd) {
  if (!dateInput || daysToAdd == null) return null;
  const dStr = String(dateInput).slice(0, 10);
  const [y, m, d] = dStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + Number(daysToAdd));
  return dt.toISOString().slice(0, 10);
}

// คำนวณแผนนัดเข้ารับ + แผนนัดส่งกลับ สำหรับ order
export function computeOrderPlanDates(order, pickupRules, returnRules, { overridePickup = null, forceRecalc = false } = {}) {
  let plan_pickup_date = overridePickup !== undefined ? overridePickup : (order.plan_pickup_date || null);
  let plan_return_date = order.plan_return_date || null;

  // 1. แผนนัดเข้ารับ: ถ้ายังไม่มี หรือสั่ง forceRecalc
  if (!plan_pickup_date || forceRecalc) {
    const pRule = resolvePickupRule(order.sales_org, pickupRules);
    if (pRule && !pRule.is_manual && pRule.days != null) {
      // บวกจากวันที่มอบหมาย (assigned_at) — ถ้ายังไม่มอบหมาย ใช้ วันที่พิมพ์ (rg_date) เป็นฐานสำรอง
      const baseDate = order.assigned_at || order.rg_date;
      if (baseDate) {
        plan_pickup_date = addDaysToDate(baseDate, pRule.days);
      }
    }
  }

  // 2. แผนนัดส่งกลับ: คำนวณจาก แผนนัดเข้ารับ (ถ้ามี) หรือ วันที่มอบหมาย / วันที่พิมพ์
  if (!plan_return_date || forceRecalc) {
    const retRule = resolveReturnRule(order, returnRules);
    if (retRule && retRule.days != null) {
      const baseReturnDate = plan_pickup_date || order.assigned_at || order.rg_date;
      if (baseReturnDate) {
        plan_return_date = addDaysToDate(baseReturnDate, retRule.days);
      }
    }
  }

  return { plan_pickup_date, plan_return_date };
}
