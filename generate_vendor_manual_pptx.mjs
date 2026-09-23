import pptxgen from 'pptxgenjs';

// Initialize Presentation
const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9'; // 10 x 5.625 inches
pres.author = 'CN TMS Team';
pres.company = 'Order CN Management System (WH08)';
pres.title = 'คู่มือการใช้งานระบบ Order CN Management System (CN TMS) - สำหรับผู้รับเหมาขนส่ง (Vendor)';

// Color Palette Definition (Based on brand.md)
const C = {
  navyDark: '0A192F',
  navyPrimary: '0D47A1',
  navyLight: '1E3A8A',
  blueAccent: '2563EB',
  blueSky: 'E0F2FE',
  blueSkyDark: '0284C7',
  redAccent: 'DC2626',
  redSoft: 'FEF2F2',
  redDark: '991B1B',
  amberAccent: 'D97706',
  amberSoft: 'FFFBEB',
  greenAccent: '059669',
  greenSoft: 'ECFDF5',
  bgPage: 'F8FAFC',
  cardBg: 'FFFFFF',
  cardBorder: 'E2E8F0',
  cardBorderLight: 'F1F5F9',
  textMain: '0F172A',
  textBody: '334155',
  textMuted: '64748B',
  textLight: '94A3B8',
  white: 'FFFFFF',
};

const FONT = 'Segoe UI'; // Universal Windows font with clean Thai & English rendering

// Helper: Add Standard Header
function addHeader(slide, title, category = 'คู่มือการใช้งานระบบ CN TMS (WH08) | บทบาท VENDOR', pageNum = '') {
  // Top category tag
  slide.addText(category.toUpperCase(), {
    x: 0.8, y: 0.35, w: 8.4, h: 0.25,
    fontSize: 9, bold: true, color: C.blueAccent, fontFace: FONT
  });
  // Title
  slide.addText(title, {
    x: 0.8, y: 0.58, w: 8.4, h: 0.45,
    fontSize: 18, bold: true, color: C.navyPrimary, fontFace: FONT
  });
  // Header underline bar
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.8, y: 1.08, w: 8.4, h: 0.02,
    fill: { color: C.cardBorder }, line: { color: C.cardBorder, width: 0 }
  });
  // Footer
  slide.addText('ระบบบริหารจัดการ Order CN (CN TMS) • เฉพาะสำหรับผู้รับเหมาขนส่ง (Vendor)', {
    x: 0.8, y: 5.25, w: 7.0, h: 0.25,
    fontSize: 8, color: C.textLight, fontFace: FONT
  });
  if (pageNum) {
    slide.addText(String(pageNum), {
      x: 8.5, y: 5.25, w: 0.7, h: 0.25,
      fontSize: 8, color: C.textLight, fontFace: FONT, align: 'right'
    });
  }
}

// ==========================================
// SLIDE 1: COVER SLIDE (Modern Dark Navy)
// ==========================================
{
  const s = pres.addSlide();
  s.background = { color: C.navyDark };

  // Decorative blue glow shape
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.25, h: 5.625,
    fill: { color: C.blueAccent }, line: { color: C.blueAccent, width: 0 }
  });

  // Badge
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 1.0, y: 0.9, w: 2.6, h: 0.35,
    rectRadius: 0.08,
    fill: { color: '1E293B' },
    line: { color: '334155', width: 1 }
  });
  s.addText('USER MANUAL • VENDOR ROLE', {
    x: 1.0, y: 0.9, w: 2.6, h: 0.35,
    fontSize: 9, bold: true, color: '60A5FA', fontFace: FONT, align: 'center', valign: 'middle'
  });

  // Main Title
  s.addText('คู่มือการใช้งานระบบ\nOrder CN Management System', {
    x: 1.0, y: 1.45, w: 8.0, h: 1.3,
    fontSize: 26, bold: true, color: C.white, fontFace: FONT, lineSpacing: 34
  });

  // Subtitle
  s.addText('ขั้นตอนและแนวทางปฏิบัติงานสำหรับผู้รับเหมาขนส่ง (Vendor)', {
    x: 1.0, y: 2.85, w: 8.0, h: 0.45,
    fontSize: 14, color: '94A3B8', fontFace: FONT
  });

  // Divider
  s.addShape(pres.shapes.RECTANGLE, {
    x: 1.0, y: 3.45, w: 8.0, h: 0.02,
    fill: { color: '334155' }, line: { color: '334155', width: 0 }
  });

  // Key Features Highlight Box
  const features = [
    { title: 'ดูงาน & พิมพ์ใบงาน', desc: 'พิมพ์ใบขนส่งและใบรับคืน' },
    { title: 'บันทึกวันรับจริง-กลับคลัง', desc: 'คีย์รายใบ หรือ บันทึกพร้อมกัน' },
    { title: 'จัดการผ่าน Excel', desc: 'Load Data & Upload ไฟล์เดียว' },
    { title: 'ติดตาม KPI ของตัวเอง', desc: 'วิเคราะห์เวลาทำงาน 3 ช่วง' },
  ];

  features.forEach((f, i) => {
    const fx = 1.0 + (i * 2.0);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: fx, y: 3.7, w: 1.85, h: 0.95,
      rectRadius: 0.06,
      fill: { color: '132238' },
      line: { color: '1E3A8A', width: 1 }
    });
    s.addText(f.title, {
      x: fx + 0.1, y: 3.78, w: 1.65, h: 0.4,
      fontSize: 10, bold: true, color: '93C5FD', fontFace: FONT
    });
    s.addText(f.desc, {
      x: fx + 0.1, y: 4.18, w: 1.65, h: 0.4,
      fontSize: 8, color: 'CBD5E1', fontFace: FONT
    });
  });

  // Footer text
  s.addText('คลังสินค้า WH08 • บริษัทและทีมงานบริหารการขนส่งสินค้าคืน (Return Goods - RG) • เวอร์ชัน 1.0', {
    x: 1.0, y: 4.95, w: 8.0, h: 0.3,
    fontSize: 9, color: '64748B', fontFace: FONT
  });
}

// ==========================================
// SLIDE 2: AGENDA (สารบัญเนื้อหา)
// ==========================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgPage };
  addHeader(s, 'สารบัญเนื้อหาการอบรม (Agenda)', 'ภาพรวมหลักสูตร', '02');

  const topics = [
    { no: '01', title: 'ภาพรวมระบบและบทบาทหน้าที่', sub: 'ความสำคัญของระบบ CN TMS และขั้นตอน Flow งานตั้งแต่ต้นจนจบ' },
    { no: '02', title: 'การเข้าสู่ระบบ (Login)', sub: 'การลงชื่อเข้าใช้งานด้วยสิทธิ์ Vendor และการดูหน้าจอหลัก' },
    { no: '03', title: 'หน้าจอ Dashboard', sub: 'ติดตามงานค้าง, สิ่งที่ต้องลงมือ และความคืบหน้าการปิดงาน' },
    { no: '04', title: 'เมนู "งานของฉัน" (My Jobs)', sub: 'การค้นหาอัจฉริยะ, กรองสถานะ และการจัดกลุ่มข้อมูล (Group By)' },
    { no: '05', title: 'การดูงานและพิมพ์ใบงาน (PDF)', sub: 'เปิดดูรายละเอียดออเดอร์, พิมพ์ใบขนส่ง และใบรับคืนสินค้า' },
    { no: '06', title: 'การบันทึกข้อมูล 3 รูปแบบ', sub: 'คีย์รายใบ (Pop-up), อัปเดตพร้อมกัน (Bulk Bar), และจัดการผ่าน Excel' },
    { no: '07', title: 'เมนู "KPI" ติดตามประสิทธิภาพ', sub: 'เกณฑ์เวลาเฉลี่ย 3 ช่วง, วิเคราะห์ข้อมูล และการ Export รายงาน' },
    { no: '08', title: 'กฎเหล็ก & ข้อควรระวังสำคัญ', sub: 'กติกาการลงวันที่, หมวดสินค้า, การปิดงาน และข้อห้ามสำคัญ' },
  ];

  topics.forEach((t, i) => {
    const col = i < 4 ? 0 : 1;
    const row = i % 4;
    const x = 0.8 + (col * 4.3);
    const y = 1.35 + (row * 0.9);

    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w: 4.1, h: 0.78,
      rectRadius: 0.06,
      fill: { color: C.cardBg },
      line: { color: C.cardBorder, width: 1 }
    });

    // Number Badge
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: x + 0.15, y: y + 0.14, w: 0.5, h: 0.5,
      rectRadius: 0.06,
      fill: { color: C.blueSky },
      line: { color: C.blueAccent, width: 0.5 }
    });
    s.addText(t.no, {
      x: x + 0.15, y: y + 0.14, w: 0.5, h: 0.5,
      fontSize: 12, bold: true, color: C.navyPrimary, fontFace: FONT, align: 'center', valign: 'middle'
    });

    // Title & Subtitle
    s.addText(t.title, {
      x: x + 0.75, y: y + 0.12, w: 3.2, h: 0.3,
      fontSize: 11, bold: true, color: C.navyPrimary, fontFace: FONT
    });
    s.addText(t.sub, {
      x: x + 0.75, y: y + 0.38, w: 3.2, h: 0.35,
      fontSize: 8.5, color: C.textMuted, fontFace: FONT
    });
  });
}

// ==========================================
// SLIDE 3: SYSTEM OVERVIEW & FLOW
// ==========================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgPage };
  addHeader(s, 'ภาพรวมระบบ และขั้นตอนการทำงาน (End-to-End Flow)', 'บทที่ 1: ภาพรวมระบบ', '03');

  // Top explanation
  s.addText('ระบบ CN TMS ออกแบบมาเพื่อบริหารจัดการสินค้าคืน (Return Goods - RG) ตั้งแต่ออเดอร์ถูกสร้างขึ้น จนสินค้าเข้าคลังสำเร็จ\nโดยระบบเชื่อมโยง 3 บทบาทหลักเข้าด้วยกันแบบไร้รอยต่อ:', {
    x: 0.8, y: 1.2, w: 8.4, h: 0.5,
    fontSize: 10, color: C.textBody, fontFace: FONT
  });

  // 3 Roles cards
  const roles = [
    { title: '1. Supervisor (หัวหน้างาน)', desc: '• นำเข้าไฟล์ All_RG.xlsx\n• Auto-assign ให้ Vendor ตามพื้นที่/ร้านค้า\n• จัดการ User, พื้นที่ และกำกับดูแลภาพรวม', tone: C.navyPrimary, bg: 'EFF6FF' },
    { title: '2. Vendor (ผู้รับเหมาขนส่ง) ★', desc: '• รับมอบหมายงาน และพิมพ์ใบงานขนส่ง\n• ไปรับสินค้าจริง และนำสินค้ากลับคืนคลัง\n• บันทึกวันรับ, วันกลับคลัง, หมวด/เหตุผล\n• ติดตาม KPI การทำงานของตนเอง', tone: C.blueAccent, bg: 'F0FDF4' },
    { title: '3. GR (ทีมคลังสินค้า WH08)', desc: '• อัปโหลดไฟล์ ReportRG เมื่อสินค้าเข้าคลัง\n• ตรวจสอบ Remark กรณีสินค้าไม่สมบูรณ์\n• ปิดงานออเดอร์ (Completed) เข้าระบบคลัง', tone: '7C3AED', bg: 'FAF5FF' },
  ];

  roles.forEach((r, i) => {
    const x = 0.8 + (i * 2.86);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y: 1.8, w: 2.68, h: 1.9,
      rectRadius: 0.08,
      fill: { color: C.cardBg },
      line: { color: r.tone, width: i === 1 ? 2 : 1 }
    });

    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: x + 0.1, y: 1.9, w: 2.48, h: 0.35,
      rectRadius: 0.04,
      fill: { color: r.bg },
      line: { color: r.bg, width: 0 }
    });
    s.addText(r.title, {
      x: x + 0.15, y: 1.9, w: 2.38, h: 0.35,
      fontSize: 10, bold: true, color: r.tone, fontFace: FONT, valign: 'middle'
    });

    s.addText(r.desc, {
      x: x + 0.15, y: 2.35, w: 2.38, h: 1.25,
      fontSize: 8.5, color: C.textBody, fontFace: FONT, lineSpacing: 14
    });
  });

  // Flow Process Bar
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.8, y: 3.9, w: 8.4, h: 1.15,
    rectRadius: 0.06,
    fill: { color: C.cardBg },
    line: { color: C.cardBorder, width: 1 }
  });

  s.addText('วงจรสถานะออเดอร์ (Order Lifecycle):', {
    x: 1.0, y: 3.98, w: 8.0, h: 0.25,
    fontSize: 9.5, bold: true, color: C.navyPrimary, fontFace: FONT
  });

  const steps = [
    { label: 'รอจัดพื้นที่', color: 'F59E0B' },
    { label: 'มอบหมายแล้ว', color: '3B82F6' },
    { label: 'รับสินค้าแล้ว', color: '8B5CF6' },
    { label: 'นำกลับคลังแล้ว', color: '06B6D4' },
    { label: 'ปิดงานสมบูรณ์', color: '10B981' },
  ];

  steps.forEach((st, i) => {
    const sx = 1.0 + (i * 1.6);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: sx, y: 4.3, w: 1.25, h: 0.45,
      rectRadius: 0.06,
      fill: { color: st.color },
      line: { color: st.color, width: 0 }
    });
    s.addText(st.label, {
      x: sx, y: 4.3, w: 1.25, h: 0.45,
      fontSize: 8.5, bold: true, color: C.white, fontFace: FONT, align: 'center', valign: 'middle'
    });
    if (i < steps.length - 1) {
      s.addText('➔', {
        x: sx + 1.25, y: 4.3, w: 0.35, h: 0.45,
        fontSize: 10, color: C.textLight, fontFace: FONT, align: 'center', valign: 'middle'
      });
    }
  });

  s.addText('★ จุดที่ Vendor รับผิดชอบลงมือ: มอบหมายแล้ว ➔ รับสินค้าแล้ว ➔ นำกลับคลังแล้ว', {
    x: 1.0, y: 4.8, w: 8.0, h: 0.2,
    fontSize: 8, bold: true, color: C.blueAccent, fontFace: FONT
  });
}

// ==========================================
// SLIDE 4: LOGIN & NAVIGATION
// ==========================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgPage };
  addHeader(s, 'การเข้าสู่ระบบ และการนำทางหลัก (Login & Navigation)', 'บทที่ 2: การเข้าสู่ระบบ', '04');

  // Left Card: Login Steps
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.8, y: 1.3, w: 3.9, h: 3.75,
    rectRadius: 0.08,
    fill: { color: C.cardBg },
    line: { color: C.cardBorder, width: 1 }
  });

  s.addText('🔐 ขั้นตอนการเข้าใช้งานระบบ', {
    x: 1.0, y: 1.45, w: 3.5, h: 0.35,
    fontSize: 12, bold: true, color: C.navyPrimary, fontFace: FONT
  });

  const loginSteps = [
    '1. เปิดเว็บบราวเซอร์ (แนะนำ Google Chrome หรือ Microsoft Edge)',
    '2. เข้าสู่ URL ระบบที่ได้รับแจ้งจากทีมงาน',
    '3. กรอก Username (ชื่อผู้ใช้) และ Password (รหัสผ่าน) ของบริษัทตนเอง',
    '4. กดปุ่ม "เข้าสู่ระบบ"',
    '5. ระบบจะตรวจสอบสิทธิ์และพาเข้าหน้า Vendor โดยอัตโนมัติ (ไม่ต้องเลือก Role)',
    '6. ชื่อบริษัทขนส่งของคุณจะปรากฏที่มุมขวาบนของหน้าเว็บ'
  ];

  loginSteps.forEach((ls, i) => {
    s.addText(ls, {
      x: 1.0, y: 1.95 + (i * 0.45), w: 3.5, h: 0.4,
      fontSize: 9, color: C.textBody, fontFace: FONT
    });
  });

  // Right Top: Navigation Tabs
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 4.9, y: 1.3, w: 4.3, h: 2.15,
    rectRadius: 0.08,
    fill: { color: C.cardBg },
    line: { color: C.cardBorder, width: 1 }
  });

  s.addText('🧭 โครงสร้าง 3 เมนูหลักของ Vendor', {
    x: 5.1, y: 1.45, w: 3.9, h: 0.35,
    fontSize: 12, bold: true, color: C.navyPrimary, fontFace: FONT
  });

  const tabs = [
    { name: '1. Dashboard', desc: 'หน้าแรกสรุปภาพรวม: งานค้าง, สิ่งที่ต้องทำทันที, ความคืบหน้าการปิดงาน' },
    { name: '2. งานของฉัน (My Jobs)', desc: 'ศูนย์จัดการออเดอร์: ค้นหา, กรอง, พิมพ์ใบงาน, คีย์วันที่ และส่งไฟล์ Excel' },
    { name: '3. KPI', desc: 'รายงานประสิทธิภาพ: เช็คค่าเฉลี่ยระยะเวลาทำงาน 3 ช่วง และ Export Excel' },
  ];

  tabs.forEach((tb, i) => {
    s.addText(tb.name, {
      x: 5.1, y: 1.9 + (i * 0.48), w: 3.9, h: 0.22,
      fontSize: 9.5, bold: true, color: C.blueAccent, fontFace: FONT
    });
    s.addText(tb.desc, {
      x: 5.1, y: 2.12 + (i * 0.48), w: 3.9, h: 0.25,
      fontSize: 8.5, color: C.textMuted, fontFace: FONT
    });
  });

  // Right Bottom: Security & Session Tips
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 4.9, y: 3.6, w: 4.3, h: 1.45,
    rectRadius: 0.08,
    fill: { color: C.amberSoft },
    line: { color: C.amberAccent, width: 1 }
  });

  s.addText('💡 ข้อแนะนำด้านความปลอดภัย (Security Tips)', {
    x: 5.1, y: 3.75, w: 3.9, h: 0.25,
    fontSize: 10, bold: true, color: C.amberAccent, fontFace: FONT
  });

  s.addText('• บัญชีผู้ใช้ผูกกับงานของบริษัทขนส่งท่านเท่านั้น จะไม่เห็นงานของเจ้าอื่น\n• เมื่อเลิกใช้งาน ให้กดปุ่ม "ออกจากระบบ" (Sign Out) บริเวณมุมขวาบนทุกครั้ง\n• กรณีลืมรหัสผ่าน ให้ติดต่อแอดมินหรือหัวหน้างาน (Supervisor) เพื่อรีเซ็ต', {
    x: 5.1, y: 4.05, w: 3.9, h: 0.85,
    fontSize: 8.5, color: C.textBody, fontFace: FONT, lineSpacing: 13
  });
}

// ==========================================
// SLIDE 5: VENDOR DASHBOARD
// ==========================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgPage };
  addHeader(s, 'หน้าแรก Dashboard — ศูนย์รวมข้อมูลและงานค้าง', 'บทที่ 3: หน้าจอ Dashboard', '05');

  // Hero Card Mockup
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.8, y: 1.3, w: 8.4, h: 1.0,
    rectRadius: 0.08,
    fill: { color: C.cardBg },
    line: { color: C.cardBorder, width: 1 }
  });

  s.addText('สวัสดีตอนเช้า, บริษัท ขนส่งตัวอย่าง จำกัด\nภาพรวมงานของคุณ • วันอังคารที่ 22 กันยายน 2569', {
    x: 1.1, y: 1.45, w: 5.5, h: 0.65,
    fontSize: 11, bold: true, color: C.navyPrimary, fontFace: FONT
  });

  // Badge Open Work
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 7.2, y: 1.55, w: 1.7, h: 0.45,
    rectRadius: 0.06,
    fill: { color: C.redSoft },
    line: { color: C.redAccent, width: 1 }
  });
  s.addText('⚠️ 12 งานค้าง', {
    x: 7.2, y: 1.55, w: 1.7, h: 0.45,
    fontSize: 11, bold: true, color: C.redAccent, fontFace: FONT, align: 'center', valign: 'middle'
  });

  // 3 Columns: Action Cards / Progress / KPI Snapshot
  // Col 1: Action Cards (สิ่งที่ต้องลงมือ)
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.8, y: 2.45, w: 2.65, h: 2.6,
    rectRadius: 0.08,
    fill: { color: C.cardBg },
    line: { color: C.cardBorder, width: 1 }
  });
  s.addText('📌 สิ่งที่ต้องลงมือทันที', {
    x: 0.95, y: 2.58, w: 2.35, h: 0.25,
    fontSize: 11, bold: true, color: C.navyPrimary, fontFace: FONT
  });

  // Sub card 1: Wait Receive
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.95, y: 2.9, w: 2.35, h: 0.95,
    rectRadius: 0.06,
    fill: { color: C.redSoft },
    line: { color: C.redAccent, width: 1 }
  });
  s.addText('📥 รอรับสินค้า (8 งาน)', {
    x: 1.05, y: 2.98, w: 2.15, h: 0.3,
    fontSize: 10, bold: true, color: C.redDark, fontFace: FONT
  });
  s.addText('ยังไม่ได้กรอกวันที่รับจริง\nรีบอัปเดตเมื่อรับของแล้ว', {
    x: 1.05, y: 3.32, w: 2.15, h: 0.45,
    fontSize: 8, color: C.redDark, fontFace: FONT
  });

  // Sub card 2: Wait Return
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.95, y: 3.95, w: 2.35, h: 0.95,
    rectRadius: 0.06,
    fill: { color: C.amberSoft },
    line: { color: C.amberAccent, width: 1 }
  });
  s.addText('🔄 รอนำกลับคลัง (4 งาน)', {
    x: 1.05, y: 4.03, w: 2.15, h: 0.3,
    fontSize: 10, bold: true, color: C.amberAccent, fontFace: FONT
  });
  s.addText('รับแล้ว รอนำสินค้ากลับ WH08\nและลงวันกลับคลังจริง', {
    x: 1.05, y: 4.37, w: 2.15, h: 0.45,
    fontSize: 8, color: C.amberAccent, fontFace: FONT
  });

  // Col 2: Progress (ความคืบหน้า)
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 3.65, y: 2.45, w: 2.65, h: 2.6,
    rectRadius: 0.08,
    fill: { color: C.cardBg },
    line: { color: C.cardBorder, width: 1 }
  });
  s.addText('📊 ความคืบหน้าการปิดงาน', {
    x: 3.8, y: 2.58, w: 2.35, h: 0.25,
    fontSize: 11, bold: true, color: C.navyPrimary, fontFace: FONT
  });

  // Progress mockup bar
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 3.8, y: 2.95, w: 2.35, h: 0.35,
    rectRadius: 0.04,
    fill: { color: 'E2E8F0' }, line: { color: 'E2E8F0', width: 0 }
  });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 3.8, y: 2.95, w: 1.75, h: 0.35,
    rectRadius: 0.04,
    fill: { color: C.greenAccent }, line: { color: C.greenAccent, width: 0 }
  });
  s.addText('75% ปิดงานแล้ว', {
    x: 3.8, y: 2.95, w: 1.75, h: 0.35,
    fontSize: 8.5, bold: true, color: C.white, fontFace: FONT, align: 'center', valign: 'middle'
  });

  s.addText('สถานะออเดอร์ทั้งหมด (48 งาน):\n• ปิดงานแล้ว (เขียว): 36 งาน\n• รอปิดงานที่คลัง (ส้ม): 4 งาน\n• อยู่ระหว่างดำเนินการ (แดง): 8 งาน\n\n📌 แนะนำ: เช็คยอดนี้ทุกเช้าเพื่อไม่ให้มีงานค้างตกหล่น', {
    x: 3.8, y: 3.45, w: 2.35, h: 1.45,
    fontSize: 8.5, color: C.textBody, fontFace: FONT, lineSpacing: 13
  });

  // Col 3: KPI Snapshot
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 6.5, y: 2.45, w: 2.7, h: 2.6,
    rectRadius: 0.08,
    fill: { color: C.cardBg },
    line: { color: C.cardBorder, width: 1 }
  });
  s.addText('⏱️ เวลาเฉลี่ยของคุณ (วัน)', {
    x: 6.65, y: 2.58, w: 2.4, h: 0.25,
    fontSize: 11, bold: true, color: C.navyPrimary, fontFace: FONT
  });

  const kpis = [
    { val: '1.2 วัน', label: '1. พิมพ์ ➔ รับสินค้า', status: 'ปกติ' },
    { val: '2.1 วัน', label: '2. รับ ➔ กลับคลัง', status: 'ปกติ' },
    { val: '3.8 วัน ⚠️', label: '3. รับ ➔ ปิดงาน (เกิน 3 วัน)', status: 'เตือน' },
  ];

  kpis.forEach((k, i) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 6.65, y: 2.95 + (i * 0.65), w: 2.4, h: 0.55,
      rectRadius: 0.04,
      fill: { color: k.status === 'เตือน' ? C.redSoft : C.bgPage },
      line: { color: k.status === 'เตือน' ? C.redAccent : C.cardBorder, width: 1 }
    });
    s.addText(k.label, {
      x: 6.75, y: 3.0 + (i * 0.65), w: 2.2, h: 0.2,
      fontSize: 8, color: C.textMuted, fontFace: FONT
    });
    s.addText(k.val, {
      x: 6.75, y: 3.22 + (i * 0.65), w: 2.2, h: 0.25,
      fontSize: 10, bold: true, color: k.status === 'เตือน' ? C.redAccent : C.navyPrimary, fontFace: FONT
    });
  });
}

// ==========================================
// SLIDE 6: MY JOBS - SEARCH & FILTERS
// ==========================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgPage };
  addHeader(s, 'เมนู "งานของฉัน" — การค้นหา คัดกรอง และจัดกลุ่มงาน', 'บทที่ 4: ค้นหาและคัดกรองงาน', '06');

  // Top feature card: Search Bar
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.8, y: 1.25, w: 8.4, h: 1.35,
    rectRadius: 0.08,
    fill: { color: C.cardBg },
    line: { color: C.blueAccent, width: 1.5 }
  });

  s.addText('🔍 1. ช่องค้นหาอัจฉริยะ (Smart Multi-Keyword Search)', {
    x: 1.0, y: 1.38, w: 8.0, h: 0.28,
    fontSize: 11, bold: true, color: C.navyPrimary, fontFace: FONT
  });

  s.addText('ค้นหาได้พร้อมกันจากหลายข้อมูล: เลขที่ RG, รหัสร้านค้า (Sold To / Ship To), ชื่อร้านค้า, อำเภอ, จังหวัด, เขต, และเหตุผล\n' +
    '• กฎการเว้นวรรค (AND): พิมพ์ "116069 บางปะกง" ➔ ผลลัพธ์ต้องมีทั้งสองคำ\n' +
    '• กฎเครื่องหมายจุลภาค (OR): พิมพ์ "บางปะกง, เมืองชลบุรี" ➔ ดึงผลลัพธ์ที่เป็นอำเภอใดอำเภอหนึ่งขึ้นมาพร้อมกัน', {
    x: 1.0, y: 1.7, w: 8.0, h: 0.8,
    fontSize: 9, color: C.textBody, fontFace: FONT, lineSpacing: 14
  });

  // Left card: Status filter
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.8, y: 2.75, w: 4.05, h: 2.3,
    rectRadius: 0.08,
    fill: { color: C.cardBg },
    line: { color: C.cardBorder, width: 1 }
  });

  s.addText('🎯 2. ตัวกรองสถานะ (Status Filter)', {
    x: 1.0, y: 2.9, w: 3.65, h: 0.28,
    fontSize: 11, bold: true, color: C.navyPrimary, fontFace: FONT
  });

  const stList = [
    { s: 'ทุกสถานะ', d: 'ดูประวัติและงานทั้งหมดในระบบ' },
    { s: 'มอบหมายแล้ว', d: 'งานใหม่ที่ต้องพิมพ์ใบงาน & ออกไปรับของ' },
    { s: 'รับสินค้าแล้ว', d: 'รับของแล้ว อยู่ระหว่างรอนำกลับเข้าคลัง' },
    { s: 'นำกลับคลังแล้ว', d: 'ส่งของคืนคลังแล้ว รอคลัง (GR) ตรวจนับ' },
    { s: 'ปิดงาน', d: 'สินค้าเข้าคลังและปิดเอกสารเรียบร้อย' },
  ];

  stList.forEach((item, i) => {
    s.addText(`• ${item.s}: `, {
      x: 1.0, y: 3.25 + (i * 0.34), w: 1.5, h: 0.3,
      fontSize: 8.5, bold: true, color: C.blueAccent, fontFace: FONT
    });
    s.addText(item.d, {
      x: 2.3, y: 3.25 + (i * 0.34), w: 2.4, h: 0.3,
      fontSize: 8.5, color: C.textBody, fontFace: FONT
    });
  });

  // Right card: Group by
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 5.15, y: 2.75, w: 4.05, h: 2.3,
    rectRadius: 0.08,
    fill: { color: C.cardBg },
    line: { color: C.cardBorder, width: 1 }
  });

  s.addText('📂 3. การจัดกลุ่มข้อมูล (Group By)', {
    x: 5.35, y: 2.9, w: 3.65, h: 0.28,
    fontSize: 11, bold: true, color: C.navyPrimary, fontFace: FONT
  });

  s.addText('เลือกจัดกลุ่มรายการเพื่อวางแผนจัดส่งหรือเลือกติ๊กงานเป็นชุดได้ง่าย:\n\n' +
    '• จัดกลุ่มตาม เขต / พื้นที่ (Zone)\n' +
    '• จัดกลุ่มตาม อำเภอ / จังหวัด (ช่วยวางแผนเส้นทางเดินรถ)\n' +
    '• จัดกลุ่มตาม รหัสร้านค้า (Sold To Code) / ชื่อร้านค้า\n' +
    '• จัดกลุ่มตาม วันที่พิมพ์ (RG Date) / วันที่มอบหมาย\n\n' +
    '💡 ประโยชน์: สามารถคลิก "เลือกทั้งหมดในกลุ่ม" ได้ทันทีในคลิกเดียว!', {
    x: 5.35, y: 3.25, w: 3.65, h: 1.7,
    fontSize: 8.5, color: C.textBody, fontFace: FONT, lineSpacing: 13
  });
}

// ==========================================
// SLIDE 7: VIEW DETAILS & PRINT PDF
// ==========================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgPage };
  addHeader(s, 'การดูรายละเอียดงาน และการพิมพ์ใบงาน (PDF Forms)', 'บทที่ 5: พิมพ์เอกสารใบงาน', '07');

  // Step explanation top
  s.addText('เมื่อต้องการดูข้อมูลเชิงลึกของออเดอร์ หรือสั่งพิมพ์เอกสารนำทาง ให้คลิกที่ไอคอน ✏️ (หรือคลิกที่แถวรายการ):', {
    x: 0.8, y: 1.2, w: 8.4, h: 0.35,
    fontSize: 10, color: C.textBody, fontFace: FONT
  });

  // Left card: Modal details preview
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.8, y: 1.6, w: 4.05, h: 3.45,
    rectRadius: 0.08,
    fill: { color: C.cardBg },
    line: { color: C.cardBorder, width: 1 }
  });

  s.addText('📋 รายละเอียดที่แสดงใน Pop-up', {
    x: 1.0, y: 1.75, w: 3.65, h: 0.28,
    fontSize: 11, bold: true, color: C.navyPrimary, fontFace: FONT
  });

  const detailFields = [
    '• เลขที่ RG (RG Number)',
    '• สถานะปัจจุบัน (Status Chip)',
    '• เลขอ้างอิง (Reference No.)',
    '• ชื่อร้านค้า & รหัส Sold To / Ship To',
    '• จำนวนสินค้า (ระบุจำนวนกล่อง และจำนวนชิ้น)',
    '• วันที่พิมพ์เอกสาร และวันที่ได้รับมอบหมาย',
    '• Remark จากคลังสินค้า (ถ้ามีบันทึกไว้)',
    '• QR Code ประจำออเดอร์ (สแกนเพื่ออ่านเลข RG ทันที)'
  ];

  detailFields.forEach((df, i) => {
    s.addText(df, {
      x: 1.0, y: 2.1 + (i * 0.33), w: 3.65, h: 0.3,
      fontSize: 8.5, color: C.textBody, fontFace: FONT
    });
  });

  // Right card: 2 PDF Types
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 5.15, y: 1.6, w: 4.05, h: 3.45,
    rectRadius: 0.08,
    fill: { color: C.cardBg },
    line: { color: C.cardBorder, width: 1 }
  });

  s.addText('🖨️ ปุ่มสั่งพิมพ์เอกสารทางการ 2 ชนิด', {
    x: 5.35, y: 1.75, w: 3.65, h: 0.28,
    fontSize: 11, bold: true, color: C.navyPrimary, fontFace: FONT
  });

  // PDF 1 Box
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 5.35, y: 2.15, w: 3.65, h: 1.15,
    rectRadius: 0.06,
    fill: { color: C.blueSky },
    line: { color: C.blueAccent, width: 1 }
  });
  s.addText('1. 🖨️ ใบขนส่ง (Transport Form)', {
    x: 5.5, y: 2.25, w: 3.35, h: 0.25,
    fontSize: 10, bold: true, color: C.navyPrimary, fontFace: FONT
  });
  s.addText('• ชื่อไฟล์: WH_<เลข RG>.pdf\n• วัตถุประสงค์: เอกสารใบแจ้งให้คนขับรถนำไปใช้ติดต่อรับสินค้า ณ ร้านค้าปลายทาง ระบุรายการสินค้าและจำนวนอย่างครบถ้วน', {
    x: 5.5, y: 2.52, w: 3.35, h: 0.7,
    fontSize: 8, color: C.textBody, fontFace: FONT, lineSpacing: 12
  });

  // PDF 2 Box
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 5.35, y: 3.45, w: 3.65, h: 1.15,
    rectRadius: 0.06,
    fill: { color: 'F0FDF4' },
    line: { color: C.greenAccent, width: 1 }
  });
  s.addText('2. 🖨️ ใบรับคืน (Receipt Form)', {
    x: 5.5, y: 3.55, w: 3.35, h: 0.25,
    fontSize: 10, bold: true, color: C.greenAccent, fontFace: FONT
  });
  s.addText('• ชื่อไฟล์: RG_<เลข RG>.pdf\n• วัตถุประสงค์: เอกสารแทนใบรับคืนสินค้า ใช้เป็นหลักฐานเซ็นรับมอบสินค้าระหว่างร้านค้า, ขนส่ง และคลังสินค้า WH08', {
    x: 5.5, y: 3.82, w: 3.35, h: 0.7,
    fontSize: 8, color: C.textBody, fontFace: FONT, lineSpacing: 12
  });

  s.addText('💡 แนะนำ: พิมพ์เอกสารทั้ง 2 ชุดมอบให้พนักงานขับรถก่อนเดินทางไปรับสินค้า', {
    x: 5.35, y: 4.7, w: 3.65, h: 0.25,
    fontSize: 8, color: C.textMuted, fontFace: FONT
  });
}

// ==========================================
// SLIDE 8: UPDATE METHOD 1 - SINGLE POP-UP
// ==========================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgPage };
  addHeader(s, 'การบันทึกข้อมูล วิธีที่ 1: กรอกรายใบผ่าน Pop-up Modal', 'บทที่ 6.1: คีย์ข้อมูลรายใบ', '08');

  // Left card: When to use & Date Rules
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.8, y: 1.3, w: 4.05, h: 3.75,
    rectRadius: 0.08,
    fill: { color: C.cardBg },
    line: { color: C.cardBorder, width: 1 }
  });

  s.addText('📅 การบันทึกวันที่จริง (รายใบ)', {
    x: 1.0, y: 1.45, w: 3.65, h: 0.28,
    fontSize: 11, bold: true, color: C.navyPrimary, fontFace: FONT
  });

  s.addText('เหมาะสำหรับ: งานที่มีการระบุรายละเอียดเฉพาะเจาะจง หรือต้องการแตกแถวหมวดสินค้าหลายรายการ\n', {
    x: 1.0, y: 1.78, w: 3.65, h: 0.45,
    fontSize: 8.5, color: C.textMuted, fontFace: FONT
  });

  const stepItems = [
    { title: '1. วันที่รับสินค้าจริง (Received Date)', desc: '• กรอกวันที่ที่พนักงานเข้ารับสินค้าจากร้านค้าจริง\n• ⚠️ ห้ามกรอกวันล่วงหน้า (ทำเสร็จแล้วค่อยกรอก)\n• กดปุ่ม "บันทึกรับ"' },
    { title: '2. วันนำสินค้ากลับคืนคลัง (Returned Date)', desc: '• กรอกวันที่สินค้าถูกนำมาส่งคืน ณ คลัง WH08\n• ใส่วันล่วงหน้าได้ (แพลนส่ง) แต่ต้องไม่น้อยกว่าวันที่รับ\n• กดปุ่ม "บันทึกกลับคลัง"' },
    { title: '🔒 กรณีงานปิดแล้ว (Completed)', desc: 'ระบบจะล็อกอัตโนมัติ ไม่สามารถแก้ไขวันที่ได้' },
  ];

  stepItems.forEach((it, i) => {
    s.addText(it.title, {
      x: 1.0, y: 2.3 + (i * 0.85), w: 3.65, h: 0.22,
      fontSize: 9, bold: true, color: C.blueAccent, fontFace: FONT
    });
    s.addText(it.desc, {
      x: 1.0, y: 2.54 + (i * 0.85), w: 3.65, h: 0.55,
      fontSize: 8, color: C.textBody, fontFace: FONT, lineSpacing: 12
    });
  });

  // Right card: Categories & Reasons
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 5.15, y: 1.3, w: 4.05, h: 3.75,
    rectRadius: 0.08,
    fill: { color: C.cardBg },
    line: { color: C.cardBorder, width: 1 }
  });

  s.addText('🏷️ การบันทึกหมวด + เหตุผล + จำนวน', {
    x: 5.35, y: 1.45, w: 3.65, h: 0.28,
    fontSize: 11, bold: true, color: C.navyPrimary, fontFace: FONT
  });

  s.addText('ในหน้าต่างเดียวกัน ด้านล่างจะมีตารางจัดการหมวดสินค้า:\n\n' +
    '1. กดปุ่ม "＋ เพิ่มแถว" เพื่อเพิ่มรายการหมวด\n' +
    '2. เลือก หมวด จาก Dropdown:\n' +
    '   • สินค้าชำรุด\n' +
    '   • สินค้าหมดอายุ\n' +
    '   • ลด Stock\n' +
    '   • อื่นๆ (⚠️ บังคับพิมพ์เหตุผลประกอบเสมอ)\n' +
    '3. กรอก จำนวนที่รับคืน (ตัวเลขไม่ติดลบ)\n' +
    '4. ระบุ หน่วย (เลือกจากรายการ เช่น กล่อง, ชิ้น, ลัง, แพ็ค, ถุง หรือพิมพ์เอง)\n' +
    '5. กดปุ่ม "บันทึกหมวด+เหตุผล" (สามารถเพิ่มได้หลายแถวใน 1 ออเดอร์)', {
    x: 5.35, y: 1.8, w: 3.65, h: 3.1,
    fontSize: 8.5, color: C.textBody, fontFace: FONT, lineSpacing: 13
  });
}

// ==========================================
// SLIDE 9: UPDATE METHOD 2 - BULK BAR
// ==========================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgPage };
  addHeader(s, 'การบันทึกข้อมูล วิธีที่ 2: อัปเดตพร้อมกันหลายใบ (Bulk Action Bar)', 'บทที่ 6.2: บันทึกงานเป็นกลุ่ม', '09');

  // Top guide
  s.addText('เหมาะสำหรับ: ขนส่งออกไปรับสินค้าพร้อมกันหลายร้าน หรือนำสินค้ากลับคืนคลังเป็นล็อตใหญ่\nช่วยประหยัดเวลาอย่างมากโดยไม่ต้องเปิดทีละใบ:', {
    x: 0.8, y: 1.2, w: 8.4, h: 0.4,
    fontSize: 9.5, color: C.textBody, fontFace: FONT
  });

  // Step 1
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.8, y: 1.7, w: 2.65, h: 3.3,
    rectRadius: 0.08,
    fill: { color: C.cardBg },
    line: { color: C.cardBorder, width: 1 }
  });
  s.addShape(pres.shapes.OVAL, {
    x: 1.0, y: 1.85, w: 0.4, h: 0.4,
    fill: { color: C.blueAccent }, line: { color: C.blueAccent, width: 0 }
  });
  s.addText('1', {
    x: 1.0, y: 1.85, w: 0.4, h: 0.4,
    fontSize: 12, bold: true, color: C.white, fontFace: FONT, align: 'center', valign: 'middle'
  });
  s.addText('ติ๊กเลือกรายการที่ต้องการ', {
    x: 1.5, y: 1.88, w: 1.8, h: 0.35,
    fontSize: 10, bold: true, color: C.navyPrimary, fontFace: FONT
  });
  s.addText('• ติ๊ก Checkbox หน้าแถวออเดอร์\n• หรือติ๊กช่อง "เลือกทั้งหมด" ที่หัวตาราง\n• หรือติ๊ก "เลือกทั้งกลุ่ม" กรณีจัดกลุ่มไว้\n• สามารถเลือกได้ตั้งแต่ 2 ถึงหลายสิบใบพร้อมกัน', {
    x: 1.0, y: 2.4, w: 2.25, h: 2.4,
    fontSize: 8.5, color: C.textBody, fontFace: FONT, lineSpacing: 14
  });

  // Step 2
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 3.65, y: 1.7, w: 2.65, h: 3.3,
    rectRadius: 0.08,
    fill: { color: C.cardBg },
    line: { color: C.cardBorder, width: 1 }
  });
  s.addShape(pres.shapes.OVAL, {
    x: 3.85, y: 1.85, w: 0.4, h: 0.4,
    fill: { color: C.blueAccent }, line: { color: C.blueAccent, width: 0 }
  });
  s.addText('2', {
    x: 3.85, y: 1.85, w: 0.4, h: 0.4,
    fontSize: 12, bold: true, color: C.white, fontFace: FONT, align: 'center', valign: 'middle'
  });
  s.addText('แถบด้านล่างจะเปิดขึ้น', {
    x: 4.35, y: 1.88, w: 1.8, h: 0.35,
    fontSize: 10, bold: true, color: C.navyPrimary, fontFace: FONT
  });
  s.addText('• หน้าจอจะแสดงแถบ Action Bar สีน้ำเงินที่ขอบล่าง\n• มีตัวเลขนับจำนวนใบที่เลือก เช่น "เลือก 15 รายการ"\n• แสดงช่องให้กรอกข้อมูลรวดเดียว:\n  - วันที่รับสินค้า\n  - วันกลับคลัง\n  - หมวด & เหตุผล\n  - จำนวนคืน & หน่วย', {
    x: 3.85, y: 2.4, w: 2.25, h: 2.4,
    fontSize: 8.5, color: C.textBody, fontFace: FONT, lineSpacing: 13
  });

  // Step 3
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 6.5, y: 1.7, w: 2.7, h: 3.3,
    rectRadius: 0.08,
    fill: { color: C.cardBg },
    line: { color: C.cardBorder, width: 1 }
  });
  s.addShape(pres.shapes.OVAL, {
    x: 6.7, y: 1.85, w: 0.4, h: 0.4,
    fill: { color: C.greenAccent }, line: { color: C.greenAccent, width: 0 }
  });
  s.addText('3', {
    x: 6.7, y: 1.85, w: 0.4, h: 0.4,
    fontSize: 12, bold: true, color: C.white, fontFace: FONT, align: 'center', valign: 'middle'
  });
  s.addText('กดปุ่ม "💾 บันทึก"', {
    x: 7.2, y: 1.88, w: 1.8, h: 0.35,
    fontSize: 10, bold: true, color: C.navyPrimary, fontFace: FONT
  });
  s.addText('• ระบบจะอัปเดตทุกใบที่เลือกพร้อมกันในคลิกเดียว\n• ช่องที่ไม่ได้กรอกจะไม่ไปทับข้อมูลเดิม\n• งานที่ปิดแล้วจะถูกข้ามให้อัตโนมัติ\n• หากพบวันที่ผิดลำดับ ระบบจะแจ้งเตือนรายชื่อใบที่ข้ามให้ทราบทันที', {
    x: 6.7, y: 2.4, w: 2.3, h: 2.4,
    fontSize: 8.5, color: C.textBody, fontFace: FONT, lineSpacing: 14
  });
}

// ==========================================
// SLIDE 10: UPDATE METHOD 3 - EXCEL TEMPLATE
// ==========================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgPage };
  addHeader(s, 'การบันทึกข้อมูล วิธีที่ 3: จัดการผ่าน Excel (Load & Upload)', 'บทที่ 6.3: ทำงานผ่านไฟล์ Excel', '10');

  // Top concept banner
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.8, y: 1.25, w: 8.4, h: 0.85,
    rectRadius: 0.06,
    fill: { color: C.blueSky },
    line: { color: C.blueAccent, width: 1 }
  });
  s.addText('🌟 ไฟล์เดียวจบ! รวมทั้ง วันที่รับ / วันกลับคลัง / หมวด / เหตุผล / จำนวนรับคืน / หน่วย', {
    x: 1.0, y: 1.35, w: 8.0, h: 0.28,
    fontSize: 10.5, bold: true, color: C.navyPrimary, fontFace: FONT
  });
  s.addText('ช่วยให้ขนส่งสามารถดาวน์โหลดข้อมูลออกไปกรอกแบบ Offline ได้ ไม่ต้องคอยกดทีละหน้าบนเว็บ เหมาะกับการสรุปยอดสิ้นวัน', {
    x: 1.0, y: 1.65, w: 8.0, h: 0.35,
    fontSize: 8.5, color: C.textBody, fontFace: FONT
  });

  // Step 1: Download
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.8, y: 2.25, w: 4.05, h: 2.8,
    rectRadius: 0.08,
    fill: { color: C.cardBg },
    line: { color: C.cardBorder, width: 1 }
  });
  s.addText('⬇️ ขั้นตอนที่ 1: ดาวน์โหลด (Load Data Excel)', {
    x: 1.0, y: 2.4, w: 3.65, h: 0.28,
    fontSize: 10.5, bold: true, color: C.navyPrimary, fontFace: FONT
  });
  s.addText('1. ปรับตัวกรองที่หน้าเว็บตามที่ต้องการ (เช่น กรองเฉพาะสถานะ "มอบหมายแล้ว" หรือค้นหาเขตที่ต้องการ)\n' +
    '2. กดปุ่ม "⬇️ Load Data Excel"\n' +
    '3. จะได้ไฟล์ชื่อ vendor-template.xlsx\n' +
    '4. โครงสร้างคอลัมน์ในไฟล์:\n' +
    '   • ข้อมูลเดิม: เลข RG, ร้านค้า, จำนวนกล่อง/ชิ้น\n' +
    '   • ช่องที่ต้องกรอก: วันที่รับสินค้า (dd/mm/yyyy), วันที่กลับคลัง (dd/mm/yyyy), หมวด, เหตุผล, จำนวนที่รับคืน, หน่วย\n' +
    '   • 1 ออเดอร์สามารถแตกได้หลายแถวตามจำนวนหมวด', {
    x: 1.0, y: 2.75, w: 3.65, h: 2.15,
    fontSize: 8.5, color: C.textBody, fontFace: FONT, lineSpacing: 13
  });

  // Step 2: Upload
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 5.15, y: 2.25, w: 4.05, h: 2.8,
    rectRadius: 0.08,
    fill: { color: C.cardBg },
    line: { color: C.cardBorder, width: 1 }
  });
  s.addText('⬆️ ขั้นตอนที่ 2: อัปโหลด (Upload Data)', {
    x: 5.35, y: 2.4, w: 3.65, h: 0.28,
    fontSize: 10.5, bold: true, color: C.navyPrimary, fontFace: FONT
  });
  s.addText('1. กรอกข้อมูลเสร็จแล้ว ให้บันทึกไฟล์ Excel\n' +
    '2. กลับมาที่หน้า "งานของฉัน" คลิก "Choose File" แล้วเลือกไฟล์\n' +
    '3. กดปุ่ม "⬆️ Upload วันที่ + หมวด/เหตุผล/จำนวน"\n' +
    '4. ระบบจะทำการตรวจสอบความถูกต้อง:\n' +
    '   ✓ บันทึกสำเร็จกี่รายการ\n' +
    '   ✓ แจ้งเตือนหากมีงานที่ปิดแล้ว (ห้ามแก้)\n' +
    '   ✓ แจ้งเตือนหากมีวันที่ผิดลำดับ\n' +
    '   ✓ แจ้งเตือนหากไม่ใช่งานของตนเอง', {
    x: 5.35, y: 2.75, w: 3.65, h: 2.15,
    fontSize: 8.5, color: C.textBody, fontFace: FONT, lineSpacing: 13
  });
}

// ==========================================
// SLIDE 11: KPI PERFORMANCE TRACKING
// ==========================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgPage };
  addHeader(s, 'เมนู "KPI" — การติดตามประสิทธิภาพและเวลาเฉลี่ย', 'บทที่ 7: การติดตาม KPI', '11');

  // KPI explanation
  s.addText('ระบบ CN TMS มีระบบประเมินตัวชี้วัดประสิทธิภาพ (KPI) อัตโนมัติ โดยวัดระยะเวลาเฉลี่ย (หน่วย: วัน) ยิ่งน้อยยิ่งดี\nหากค่าเฉลี่ยเกินเกณฑ์ (เช่น เกิน 3 วัน) ตัวเลขจะเปลี่ยนเป็นสีแดงเตือนทันที:', {
    x: 0.8, y: 1.2, w: 8.4, h: 0.45,
    fontSize: 9.5, color: C.textBody, fontFace: FONT
  });

  // 3 KPI Stages
  const kpiStages = [
    { no: 'ช่วงที่ 1️⃣', name: 'วันที่พิมพ์ ➔ รับสินค้า', sub: 'ความเร็วในการเข้ารับงาน', desc: 'นับตั้งแต่วันที่คลังสร้างเอกสาร จนถึงวันที่ขนส่งไปรับสินค้าจากร้านค้าจริง\n• เกณฑ์ปกติ: ≤ 3 วัน\n• ปัจจัย: ความพร้อมของรถขนส่งและการวางแผนคิว' },
    { no: 'ช่วงที่ 2️⃣', name: 'รับสินค้า ➔ นำกลับคลัง', sub: 'ระยะเวลาดำเนินการขนส่ง', desc: 'นับตั้งแต่วันที่รับสินค้า จนถึงวันที่นำสินค้ากลับมาถึงคลัง WH08\n• เกณฑ์ปกติ: ≤ 3 วัน\n• ปัจจัย: ระยะทางและการบริหารรอบรถขนส่ง' },
    { no: 'ช่วงที่ 3️⃣', name: 'รับสินค้า ➔ ปิดงาน', sub: 'รวมจนจบกระบวนการ', desc: 'นับตั้งแต่วันที่รับสินค้า จนถึงวันที่ทีมคลังสินค้า (GR) อัปโหลดเอกสารปิดงาน\n• เกณฑ์ปกติ: ≤ 3 วัน\n• ปัจจัย: ความถูกต้องของสินค้าและการเคลียร์ Remark' },
  ];

  kpiStages.forEach((ks, i) => {
    const x = 0.8 + (i * 2.86);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y: 1.75, w: 2.68, h: 2.1,
      rectRadius: 0.08,
      fill: { color: C.cardBg },
      line: { color: C.cardBorder, width: 1 }
    });

    s.addText(ks.no, {
      x: x + 0.15, y: 1.88, w: 2.38, h: 0.22,
      fontSize: 8.5, bold: true, color: C.blueAccent, fontFace: FONT
    });
    s.addText(ks.name, {
      x: x + 0.15, y: 2.1, w: 2.38, h: 0.28,
      fontSize: 10, bold: true, color: C.navyPrimary, fontFace: FONT
    });
    s.addText(ks.sub, {
      x: x + 0.15, y: 2.38, w: 2.38, h: 0.22,
      fontSize: 8, color: C.textMuted, fontFace: FONT
    });
    s.addText(ks.desc, {
      x: x + 0.15, y: 2.65, w: 2.38, h: 1.1,
      fontSize: 7.8, color: C.textBody, fontFace: FONT, lineSpacing: 11
    });
  });

  // Bottom card: Drill-down & Export
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.8, y: 4.0, w: 8.4, h: 1.05,
    rectRadius: 0.08,
    fill: { color: C.cardBg },
    line: { color: C.cardBorder, width: 1 }
  });

  s.addText('📊 ฟังก์ชันวิเคราะห์และดาวน์โหลดรายงาน (Drill-down & Export)', {
    x: 1.0, y: 4.1, w: 8.0, h: 0.25,
    fontSize: 10, bold: true, color: C.navyPrimary, fontFace: FONT
  });

  s.addText('• เลือกช่วงวันที่: กำหนด "ตั้งแต่วันที่พิมพ์" ถึง "ถึงวันที่พิมพ์" แล้วกด "ค้นหา"\n' +
    '• เจาะดูรายออเดอร์: คลิกที่แถวสรุปของตนเอง ระบบจะแสดงตารางรายละเอียดออเดอร์ทุกใบพร้อมระยะเวลาของแต่ละใบ\n' +
    '• ส่งออกรายงาน: กด "⬇️ Export สรุป" หรือ "⬇️ Export รายออเดอร์" เพื่อนำข้อมูลเป็น Excel ไปใช้วิเคราะห์ต่อ', {
    x: 1.0, y: 4.38, w: 8.0, h: 0.6,
    fontSize: 8.5, color: C.textBody, fontFace: FONT, lineSpacing: 12
  });
}

// ==========================================
// SLIDE 12: IRONCLAD RULES & BEST PRACTICES
// ==========================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgPage };
  addHeader(s, 'กฎเหล็กและข้อควรระวังสำคัญ (Ironclad Rules & FAQ)', 'บทที่ 8: กฎระเบียบและข้อควรระวัง', '12');

  const rules = [
    {
      badge: '⚠️ กฎที่ 1',
      title: 'วันที่รับสินค้าจริง: "ทำเสร็จแล้วค่อยกรอก"',
      desc: 'ระบบจะไม่อนุญาตให้กรอกวันที่รับสินค้าล่วงหน้าเด็ดขาด (Max Date = วันนี้) ต้องไปรับของจริงก่อน จึงกลับมาคีย์ข้อมูล',
      tone: C.redAccent, bg: C.redSoft
    },
    {
      badge: '⚠️ กฎที่ 2',
      title: 'วันกลับคลัง ต้องไม่น้อยกว่า วันที่รับสินค้า',
      desc: 'วันนำสินค้ากลับคืนคลัง (WH08) สามารถใส่วันล่วงหน้าได้ (แผนส่งของ) แต่ต้องมีค่ามากกว่าหรือเท่ากับวันที่รับสินค้าเสมอ',
      tone: C.redAccent, bg: C.redSoft
    },
    {
      badge: '⚠️ กฎที่ 3',
      title: 'หมวด "อื่นๆ" บังคับกรอกเหตุผลเสมอ',
      desc: 'หากเลือกหมวดเป็น "อื่นๆ" ระบบจะบังคับให้พิมพ์เหตุผลประกอบทุกครั้ง หากไม่พิมพ์จะไม่สามารถกดบันทึกได้',
      tone: C.amberAccent, bg: C.amberSoft
    },
    {
      badge: '⚠️ กฎที่ 4',
      title: 'งานที่ปิดแล้ว (Completed) แก้ไขวันที่ไม่ได้',
      desc: 'เมื่อทีมคลัง (GR) นำสินค้าเข้าระบบและปิดงานแล้ว สถานะจะถูกล็อกทันที หากต้องการแก้ไขต้องแจ้ง Supervisor เท่านั้น',
      tone: C.blueAccent, bg: C.blueSky
    },
  ];

  rules.forEach((r, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.8 + (col * 4.3);
    const y = 1.3 + (row * 1.8);

    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w: 4.1, h: 1.65,
      rectRadius: 0.08,
      fill: { color: C.cardBg },
      line: { color: r.tone, width: 1 }
    });

    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: x + 0.15, y: y + 0.15, w: 0.9, h: 0.3,
      rectRadius: 0.04,
      fill: { color: r.bg }, line: { color: r.bg, width: 0 }
    });
    s.addText(r.badge, {
      x: x + 0.15, y: y + 0.15, w: 0.9, h: 0.3,
      fontSize: 8.5, bold: true, color: r.tone, fontFace: FONT, align: 'center', valign: 'middle'
    });

    s.addText(r.title, {
      x: x + 1.15, y: y + 0.15, w: 2.8, h: 0.35,
      fontSize: 9.5, bold: true, color: C.navyPrimary, fontFace: FONT
    });

    s.addText(r.desc, {
      x: x + 0.15, y: y + 0.58, w: 3.8, h: 0.95,
      fontSize: 8.5, color: C.textBody, fontFace: FONT, lineSpacing: 13
    });
  });

  // Bottom FAQ note
  s.addText('❓ หากคลังแจ้งว่ามี Remark ค้างอยู่ ทำอย่างไร? ➔ ตรวจสอบสินค้า หากมีปัญหาประสานงานกับทีมคลัง WH08 เพื่อเคลียร์ของและปิดงาน', {
    x: 0.8, y: 4.95, w: 8.4, h: 0.25,
    fontSize: 8.5, bold: true, color: C.textMuted, fontFace: FONT
  });
}

// ==========================================
// SLIDE 13: DAILY CHECKLIST & SUPPORT
// ==========================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgPage };
  addHeader(s, 'สรุปแนวทางปฏิบัติรายวัน และช่องทางติดต่อ (Checklist & Support)', 'บทสรุป', '13');

  // Left card: Daily Checklist
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.8, y: 1.3, w: 4.8, h: 3.75,
    rectRadius: 0.08,
    fill: { color: C.cardBg },
    line: { color: C.cardBorder, width: 1 }
  });

  s.addText('📋 Daily Checklist สำหรับพนักงานและผู้ควบคุม Vendor', {
    x: 1.0, y: 1.45, w: 4.4, h: 0.28,
    fontSize: 11, bold: true, color: C.navyPrimary, fontFace: FONT
  });

  const cl = [
    { time: 'ช่วงเช้า (08:00 - 09:00)', text: '1. ล็อกอินเข้า Dashboard ดูจำนวนงานค้าง (รอรับ / รอนำกลับ)\n2. ไปที่ "งานของฉัน" กรองสถานะ "มอบหมายแล้ว"\n3. จัดกลุ่มตามเขต/อำเภอ วางแผนคิวรถ แล้วพิมพ์ใบขนส่ง + ใบรับคืน' },
    { time: 'ระหว่างวัน (ปฏิบัติงานจริง)', text: '4. รถขนส่งเข้ารับสินค้าจริง ตรวจนับจำนวนกล่อง/ชิ้น\n5. นำสินค้ากลับมาส่งคืน ณ คลังสินค้า WH08' },
    { time: 'ช่วงเย็น (16:00 - 18:00)', text: '6. เข้าเมนู "งานของฉัน" คีย์วันที่รับจริง และวันกลับคลัง (คีย์รายใบ/หลายใบ/Excel)\n7. บันทึกหมวดและเหตุผลการรับคืนให้ครบถ้วน\n8. ตรวจสอบหน้า Dashboard เพื่อให้มั่นใจว่า "ไม่มีงานค้าง 🎉"' },
  ];

  cl.forEach((item, i) => {
    s.addText(item.time, {
      x: 1.0, y: 1.85 + (i * 0.98), w: 4.4, h: 0.22,
      fontSize: 9, bold: true, color: C.blueAccent, fontFace: FONT
    });
    s.addText(item.text, {
      x: 1.0, y: 2.08 + (i * 0.98), w: 4.4, h: 0.72,
      fontSize: 8.2, color: C.textBody, fontFace: FONT, lineSpacing: 11
    });
  });

  // Right card: Contact Support & Q&A
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 5.9, y: 1.3, w: 3.3, h: 3.75,
    rectRadius: 0.08,
    fill: { color: C.cardBg },
    line: { color: C.cardBorder, width: 1 }
  });

  s.addText('📞 ช่องทางติดต่อประสานงาน', {
    x: 6.1, y: 1.45, w: 2.9, h: 0.28,
    fontSize: 11, bold: true, color: C.navyPrimary, fontFace: FONT
  });

  s.addText('🏢 คลังสินค้า WH08 (Goods Receipt)\n• ติดต่อสอบถามการรับมอบสินค้าและ Remark\n\n' +
    '👤 ทีมประสานงานระบบ (Supervisor/Admin)\n• แจ้งปัญหาการใช้งานระบบ, เพิ่มผู้ใช้ หรือรีเซ็ตรหัสผ่าน\n\n' +
    '⏱️ เวลาทำการประสานงาน:\n• จันทร์ - เสาร์: 08:00 - 17:00 น.\n\n' +
    '💬 กลุ่ม Line ประสานงานขนส่ง CN TMS', {
    x: 6.1, y: 1.85, w: 2.9, h: 2.0,
    fontSize: 8.5, color: C.textBody, fontFace: FONT, lineSpacing: 13
  });

  // Thank you badge
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 6.1, y: 4.0, w: 2.9, h: 0.85,
    rectRadius: 0.06,
    fill: { color: C.navyPrimary }, line: { color: C.navyPrimary, width: 0 }
  });
  s.addText('ขอบคุณผู้ร่วมงานทุกท่าน\nOrder CN Management System', {
    x: 6.1, y: 4.0, w: 2.9, h: 0.85,
    fontSize: 9.5, bold: true, color: C.white, fontFace: FONT, align: 'center', valign: 'middle'
  });
}

// Save presentation
const outPath = 'คู่มือการใช้งาน_ระบบ_CN_TMS_สำหรับ_Vendor.pptx';
await pres.writeFile({ fileName: outPath });
console.log(`Presentation generated successfully: ${outPath}`);
