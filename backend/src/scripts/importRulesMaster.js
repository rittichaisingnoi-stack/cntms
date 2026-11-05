import { supabase } from '../lib/supabase.js';
import XLSX from 'xlsx';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function importRulesFromExcel(excelPath) {
  const targetFile = excelPath || path.resolve(__dirname, '../../../../Rules Master.xlsx');
  console.log(`[importRules] Reading Excel file: ${targetFile}`);

  if (!fs.existsSync(targetFile)) {
    throw new Error(`ไม่พบไฟล์: ${targetFile}`);
  }

  const wb = XLSX.readFile(targetFile);
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(ws);
  console.log(`[importRules] Total raw rows: ${rawRows.length} from sheet "${sheetName}"`);

  // ดึงรายชื่อ Vendor จากตาราง users
  const { data: vendorUsers, error: uErr } = await supabase
    .from('users')
    .select('id, username, display_name')
    .eq('role', 'vendor');
  if (uErr) throw new Error(`ดึงข้อมูล vendor users ล้มเหลว: ${uErr.message}`);

  const normalizeVendorKey = (s) =>
    String(s ?? '')
      .replace(/\s+/g, '')
      .replace(/ิ้/g, 'ิ') // ทริปเปิ้ล -> ทริปเปิล
      .replace(/นิว/g, 'นิ') // ยูนิวเวอร์แซล -> ยูนิเวอร์แซล
      .replace(/tranport/i, 'transport') // TRANPORT -> TRANSPORT
      .toLowerCase();

  const vendorIdByName = new Map();
  for (const u of vendorUsers || []) {
    if (u.display_name) vendorIdByName.set(normalizeVendorKey(u.display_name), u.id);
    if (u.username) vendorIdByName.set(normalizeVendorKey(u.username), u.id);
  }

  // Fallback explicit mappings
  const knownMap = {
    [normalizeVendorKey('Ruamthavorn Group')]: 75,
    [normalizeVendorKey('RTT')]: 75,
    [normalizeVendorKey('บริษัท ธัญญทิพย์ เอ็กซ์เพรส จำกัด')]: 131,
    [normalizeVendorKey('TYT')]: 131,
    [normalizeVendorKey('บริษัท ทริปเปิ้ล ไลน์ โลจิสติกส์ จำกัด')]: 77,
    [normalizeVendorKey('บริษัท ทริปเปิล ไลน์ โลจิสติกส์ จำกัด')]: 77,
    [normalizeVendorKey('TPL')]: 77,
    [normalizeVendorKey('NEOSIAM LOGISTICS & TRANPORT')]: 76,
    [normalizeVendorKey('NEOSIAM LOGISTICS & TRANSPORT')]: 76,
    [normalizeVendorKey('NEO')]: 76,
    [normalizeVendorKey('บริษัทยูนิวเวอร์แซล ทรานสปอร์ต')]: 78,
    [normalizeVendorKey('บริษัทยูนิเวอร์แซล ทรานสปอร์ต')]: 78,
    [normalizeVendorKey('UET')]: 78,
  };

  const resolveVendorId = (transportName) => {
    const key = normalizeVendorKey(transportName);
    return vendorIdByName.get(key) || knownMap[key] || null;
  };

  const FIELD_PRIORITY = { sold_to: 1, sold_to_code: 2, zone: 3, region: 4 };

  // แปลงแถวและขจัดข้อมูลซ้ำ (แถวหลังแทนที่แถวหน้า)
  const rulesMap = new Map();
  let duplicateCount = 0;

  for (const r of rawRows) {
    const setVal = String(r['Set'] ?? '').trim();
    const ptVal = String(r['Sold-to pt'] ?? '').trim();
    const transportVal = String(r['Transport'] ?? '').trim();

    if (!setVal || !ptVal || !transportVal) continue;

    const vendorId = resolveVendorId(transportVal);
    if (!vendorId) {
      console.warn(`[importRules] ไม่พบ Vendor ID สำหรับ: "${transportVal}" (แถวค่า ${ptVal})`);
      continue;
    }

    let rule_field = null;
    if (setVal.toLowerCase() === 'sold-to') {
      rule_field = 'sold_to_code';
    } else if (setVal.toLowerCase() === 'ship-to') {
      rule_field = 'sold_to';
    } else {
      console.warn(`[importRules] ค่า Set ไม่รู้จัก: "${setVal}"`);
      continue;
    }

    const key = `${rule_field}::${ptVal.toLowerCase()}`;
    if (rulesMap.has(key)) {
      duplicateCount++;
    }

    rulesMap.set(key, {
      priority: FIELD_PRIORITY[rule_field] || 100,
      rule_field,
      match_value: ptVal,
      area: null,
      vendor_id: vendorId,
      enabled: true,
      created_at: new Date().toISOString(),
    });
  }

  const newRules = [...rulesMap.values()];
  console.log(`[importRules] Prepared ${newRules.length} unique rules (Duplicates replaced: ${duplicateCount})`);

  // 1. ลบกติกาเดิมทั้งหมดในตาราง area_rules
  console.log(`[importRules] Deleting all old rules from area_rules...`);
  const { error: delErr } = await supabase.from('area_rules').delete().gte('id', 0);
  if (delErr) {
    throw new Error(`ลบกติกาเดิมล้มเหลว: ${delErr.message}`);
  }
  console.log(`[importRules] All old rules deleted successfully.`);

  // 2. นำเข้าข้อมูลกติกาใหม่เป็น batch
  const BATCH_SIZE = 500;
  let inserted = 0;
  for (let i = 0; i < newRules.length; i += BATCH_SIZE) {
    const batch = newRules.slice(i, i + BATCH_SIZE);
    const { error: insErr } = await supabase.from('area_rules').insert(batch);
    if (insErr) {
      throw new Error(`บันทึกกติกา batch ${i} - ${i + batch.length} ล้มเหลว: ${insErr.message}`);
    }
    inserted += batch.length;
    console.log(`[importRules] Inserted ${inserted}/${newRules.length}...`);
  }

  // 3. ตรวจสอบจำนวนในตาราง
  const { count: finalCount, error: cntErr } = await supabase
    .from('area_rules')
    .select('*', { count: 'exact', head: true });
  if (cntErr) throw cntErr;

  console.log(`[importRules] Complete! Total area_rules in DB now: ${finalCount}`);
  return {
    totalRowsInExcel: rawRows.length,
    uniqueRules: newRules.length,
    duplicatesReplaced: duplicateCount,
    finalCountInDb: finalCount,
  };
}

// ถ้าถูกเรียกตรงๆ จาก command line
if (process.argv[1] && process.argv[1].endsWith('importRulesMaster.js')) {
  importRulesFromExcel(process.argv[2])
    .then((result) => {
      console.log('Result:', result);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error:', err);
      process.exit(1);
    });
}
