// ============ CNTMS SPA — role-based Order CN management ============
const $ = (s, r = document) => r.querySelector(s);
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtDate = (iso) => { if (!iso) return '-'; const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
const fmtDateTime = (iso) => { if (!iso) return '-'; const dt = new Date(iso); if (isNaN(dt)) return fmtDate(iso); const p = (n) => String(n).padStart(2, '0'); return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()} ${p(dt.getHours())}:${p(dt.getMinutes())}`; };

// วันนี้ (yyyy-mm-dd) — ใช้เป็น max ของช่องวันที่ กันกรอกวันล่วงหน้า
const todayStr = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

let token = localStorage.getItem('cntms_token') || '';
let me = null;

const api = (p, o = {}) => {
  const headers = { ...(o.headers || {}) };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch('/api' + p, { ...o, headers }).then(async (r) => {
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('application/json')) { if (!r.ok) throw new Error(r.statusText); return r; }
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { doLogout(true); throw new Error(j.error || 'กรุณาเข้าสู่ระบบ'); }
    if (!r.ok) throw new Error(j.error || r.statusText);
    return j;
  });
};
const withToken = (url) => url + (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);

// ---------- status labels ----------
const STATUS = {
  pending: 'รอจัดพื้นที่', assigned_vendor: 'มอบหมายแล้ว',
  received: 'รับสินค้าแล้ว', returned: 'นำกลับคลังแล้ว',
  gr_received: 'รับสินค้าเข้าระบบ',   // GR upload แล้วมี Remark — ยังไม่ปิดงาน
  completed: 'ปิดงาน',
};
const statusChip = (s) => `<span class="chip st st-${s}">${STATUS[s] || s || 'รอดำเนินการ'}</span>`;

// ---------- หมวดสำหรับ dropdown ในตารางหมวด+เหตุผล (Vendor) ----------
// TODO: แก้รายการนี้ตามหมวดที่ต้องการ (แต่ละแถวเลือกหมวด → บังคับกรอกเหตุผล)
// หมวดของ Vendor — โหลดจาก settings ตอน login (แก้ได้ในแท็บ "จัดการผู้ใช้")
let NOTE_CATEGORIES = ['สินค้าชำรุด', 'สินค้าหมดอายุ', 'ลด Stock', 'อื่นๆ'];
async function loadNoteCategories() {
  try {
    const list = await api('/lookup/note-categories');
    if (Array.isArray(list) && list.length) NOTE_CATEGORIES = list;
  } catch { /* ใช้ค่าเริ่มต้น */ }
}

// Sold To Code ที่ซ่อนเป็นค่าเริ่มต้นในหน้า "ออเดอร์รอจัดพื้นที่" (ติ๊กออกเพื่อดูได้)
const HIDE_SOLD_TO_CODE = '011606';

// ---------- Vendor list ที่ใช้ร่วมกันทุกหน้า ----------
// order.vendor_id → users.id · แคชครั้งเดียวเพื่อแสดง "ชื่อ Vendor" ในตารางโดยไม่ต้อง join ฝั่ง API
let VENDOR_LIST = [];
const vendorLabel = (id) => {
  if (!id) return null;
  return VENDOR_LIST.find((v) => v.id === id)?.display_name || `#${id}`;
};
async function loadVendorList() {
  try { VENDOR_LIST = await api('/lookup/vendors') || []; } catch { VENDOR_LIST = []; }
  return VENDOR_LIST;
}

// โหลดเกณฑ์ KPI (threshold 3 ช่วง) จาก DB — เรียกตอน login
async function loadKpiLimits() {
  try {
    const v = await api('/lookup/kpi-limits');
    if (v && typeof v === 'object') {
      for (const k of ['d1', 'd2', 'd3']) if (Number(v[k]) > 0) KPI_LIMITS[k] = Number(v[k]);
    }
  } catch { /* ใช้ค่าเริ่มต้น 3 ทุกช่วง */ }
}

// ---------- role → menu config ----------
// each item: {id, label, render}
const ROLE_LABEL = {
  vendor: 'Vendor', gr: 'GR คลังสินค้า', supervisor: 'Supervisor', admin: 'Admin',
};

function menuFor(role) {
  const M = {
    vendor: ['myjobs', 'kpi', 'dashboard'],
    gr: ['grimport', 'grlist', 'kpi', 'dashboard'],
    supervisor: ['import', 'unassigned', 'orders', 'arearules', 'users', 'kpi', 'dashboard'],
    admin: ['import', 'unassigned', 'orders', 'arearules', 'users', 'kpi', 'dashboard'],
  };
  return (M[role] || ['dashboard']).map((id) => VIEWS[id]).filter(Boolean);
}

// ============ VIEWS ============
const VIEWS = {};

// ---- generic order list (reused) ----
async function fetchOrders(params = {}) {
  const p = new URLSearchParams(params);
  return api('/orders?' + p.toString());
}

function orderCard(o, onClick) {
  const c = el(`<div class="rg">
    <div class="no">${esc(o.rg_no)}</div>
    <div class="name">${esc(o.sold_to_name || '-')}</div>
    <div class="meta">
      ${statusChip(o.status)}
      <span class="chip">กล่อง ${o.qty_boxes ?? 0}</span>
      <span class="chip">ชิ้น ${o.qty_pieces ?? 0}</span>
      ${o.wh_code ? `<span class="chip">${esc(o.wh_code)}</span>` : ''}
      ${o.reference ? `<span class="chip ref">Ref ${esc(o.reference)}</span>` : ''}
      ${o.area ? `<span class="chip">พื้นที่ ${esc(o.area)}</span>` : ''}
      ${o.rg_date ? `<span class="chip">${fmtDate(o.rg_date)}</span>` : ''}
    </div></div>`);
  c.onclick = () => onClick(o);
  return c;
}

// paginated list helper — renders into container, wires pager
// ส่ง renderRows(data, reload) เพื่อ render แบบตาราง (แทน onCard ทีละใบ)
function listView({ title, hint, params, onCard, renderRows, filters, wide }) {
  let page = 1;
  const wrap = el(`<div class="view ${wide ? 'wide' : ''}"><h3>${title}</h3>${hint ? `<p class="hint">${hint}</p>` : ''}
    <div class="filters card" id="flt"></div>
    <div class="results" id="res"></div><div class="pager" id="pg"></div></div>`);
  const res = $('#res', wrap), pg = $('#pg', wrap), flt = $('#flt', wrap);
  if (filters) flt.appendChild(filters(() => { page = 1; load(); })); else flt.remove();

  async function load() {
    res.innerHTML = '<div class="empty">กำลังโหลด…</div>';
    try {
      const q = typeof params === 'function' ? params() : params;
      const { data, total, pageSize } = await fetchOrders({ ...q, page });
      if (!data.length) { res.innerHTML = '<div class="empty">ไม่พบรายการ</div>'; pg.innerHTML = ''; return; }
      res.innerHTML = '';
      if (renderRows) res.appendChild(renderRows(data, load));
      else data.forEach((o) => res.appendChild(onCard(o, load)));
      const pages = Math.ceil(total / pageSize) || 1;
      pg.innerHTML = `<button ${page <= 1 ? 'disabled' : ''} id="prev">‹ ก่อนหน้า</button>
        <span style="align-self:center">หน้า ${page}/${pages} · รวม ${total}</span>
        <button ${page >= pages ? 'disabled' : ''} id="next">ถัดไป ›</button>`;
      const prev = $('#prev', pg), next = $('#next', pg);
      if (prev) prev.onclick = () => { page--; load(); };
      if (next) next.onclick = () => { page++; load(); };
    } catch (e) { res.innerHTML = `<div class="empty err">${esc(e.message)}</div>`; }
  }
  wrap._load = load;
  load();
  return wrap;
}

// ตัวเลือก "จัดกลุ่มตาม" ที่ใช้ร่วมกันหลายหน้า
const GROUP_FIELDS = [
  { key: '', label: 'ไม่จัดกลุ่ม' },
  { key: 'ship_to_name', label: 'Ship To (ที่อยู่ส่ง)' },
  { key: 'sold_to_name', label: 'Sold To (ร้านค้า)' },
  { key: 'zone', label: 'Zone (เขต)' },
  { key: 'province', label: 'จังหวัด' },
];

// ---- Supervisor: Import Excel (Upload → Auto Assign Vendor) ----
VIEWS.import = {
  id: 'import', label: 'นำเข้า Excel',
  render: () => {
    const w = el(`<div class="view wide"><div class="card">
      <h3>นำเข้ารายงาน RG (.xlsx)</h3>
      <p class="hint">รองรับรายงานสรุป RG และ ReportRG (รายละเอียดสินค้า) — ระบบตรวจรูปแบบอัตโนมัติ ลบข้อมูลซ้ำให้
      · เลือกไฟล์แล้วจะแสดง <b>ตัวอย่างให้ตรวจ/แก้ไขก่อนบันทึก</b></p>
      <div class="row">
        <input id="file" type="file" accept=".xlsx,.xls" class="in" style="flex:1"/>
        <button id="prev" class="btn primary" style="width:auto">ตรวจ / แก้ไข</button>
        <button id="up" class="btn ghost" style="width:auto">บันทึกทันที</button>
      </div>
      <div id="ir"></div></div>
      <div id="preview"></div></div>`);
    const out = $('#ir', w), pv = $('#preview', w);

    // ---- แสดงผลลัพธ์หลังบันทึก ----
    function showResult(r) {
      let html = `<p class="ok">สำเร็จ · รูปแบบ: ${r.format} · หัวข้อ ${r.imported.headers} · สินค้า ${r.imported.items}</p>`
        + (r.auto_assigned ? `<p class="ok">🤖 Auto Assign Vendor ตามกติกา ${r.auto_assigned} รายการ</p>` : '')
        + (r.waiting_assignment ? `<p class="err">⚠️ มี ${r.waiting_assignment} ออเดอร์ไม่ตรงกติกาใด — ค้างอยู่ที่ "รอจัดพื้นที่"</p>` : '');
      if (r.new_shops?.length) {
        html += `<div class="alert-banner">🔔 พบร้านใหม่ที่ยังไม่มีในกติกา ${r.new_shops.length} ร้าน —
          ไปที่แท็บ "กติกาจัดพื้นที่" เพื่อเพิ่ม แล้วกด Re-assign หรือ assign มือที่แท็บ "รอจัดพื้นที่"</div>
          <div class="table-scroll"><table class="otable"><thead><tr>
          <th>Ship To Code</th><th>Ship To</th><th>Sold To Code</th><th>เขต</th><th>ชื่อร้าน</th>
          </tr></thead><tbody>${r.new_shops.map((n) => `<tr>
            <td>${esc(n.ship_to_code || '-')}</td><td>${esc(n.sold_to || '-')}</td>
            <td>${esc(n.sold_to_code || '-')}</td><td>${esc(n.zone || '-')}</td>
            <td class="l">${esc(n.sold_to_name || '-')}</td></tr>`).join('')}</tbody></table></div>`;
      }
      out.innerHTML = html; pv.innerHTML = '';
      // แจ้งเตือนเด้งให้เห็นทันที (ผู้ใช้อาจกำลัง scroll ดูตารางอยู่ล่างสุด)
      const parts = [`บันทึกสำเร็จ · ${r.imported.headers} ออเดอร์`];
      if (r.auto_assigned) parts.push(`Auto Assign ${r.auto_assigned}`);
      if (r.waiting_assignment) parts.push(`รอจัดพื้นที่ ${r.waiting_assignment}`);
      if (r.new_shops?.length) parts.push(`ร้านใหม่ ${r.new_shops.length}`);
      toast('✅ ' + parts.join(' · '));
      out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // ---- บันทึกทันที (ข้าม preview) ----
    $('#up', w).onclick = async () => {
      const f = $('#file', w).files[0];
      if (!f) { out.innerHTML = '<p class="err">กรุณาเลือกไฟล์</p>'; return; }
      out.innerHTML = 'กำลังบันทึก…'; pv.innerHTML = '';
      const fd = new FormData(); fd.append('file', f);
      try { showResult(await api('/rg/import', { method: 'POST', body: fd })); }
      catch (e) { out.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
    };

    // ---- ตรวจ/แก้ไข: parse แล้วแสดงฟอร์ม ----
    $('#prev', w).onclick = async () => {
      const f = $('#file', w).files[0];
      if (!f) { out.innerHTML = '<p class="err">กรุณาเลือกไฟล์</p>'; return; }
      out.innerHTML = 'กำลังอ่านไฟล์…'; pv.innerHTML = '';
      const fd = new FormData(); fd.append('file', f);
      try {
        const p = await api('/rg/parse', { method: 'POST', body: fd });
        out.innerHTML = '';
        if (p.format !== 'summary') {
          // ReportRG (detail) ไม่มี header ให้แก้ — บันทึกตรงได้เลย
          pv.innerHTML = `<div class="card"><p class="hint">ไฟล์นี้เป็น <b>ReportRG (รายละเอียดสินค้า)</b> — ไม่มีหัวออเดอร์ให้แก้ไข พบสินค้า ${p.items.length} รายการ</p>
            <button class="btn primary" id="pv-save" style="width:auto">บันทึกเข้าระบบ</button></div>`;
          $('#pv-save', pv).onclick = $('#up', w).onclick;
          return;
        }
        renderEditForm(p.headers);
      } catch (e) { out.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
    };

    // ---- ฟอร์มแก้ไข header ก่อนบันทึก ----
    function renderEditForm(headers) {
      const cols = [
        ['rg_no', 'เลขที่ RG', 120], ['zone', 'เขต', 70], ['sold_to_code', 'Sold To Code', 95],
        ['ship_to_code', 'Ship To Code', 95], ['sold_to', 'Ship To', 95], ['sold_to_name', 'ชื่อร้าน (Sold To)', 200],
        ['qty_boxes', 'กล่อง', 60], ['qty_pieces', 'ชิ้น', 60],
        ['district', 'อำเภอ', 110], ['province', 'จังหวัด', 110], ['region', 'Region', 90],
        ['wh_code', 'WH', 70], ['reason_text', 'เหตุผล', 150],
      ];
      const card = el(`<div class="card">
        <div class="row" style="justify-content:space-between;align-items:center">
          <h4 style="margin:0">ตรวจ / แก้ไขก่อนบันทึก · <span id="pv-count">${headers.length}</span> ออเดอร์</h4>
          <div class="row" style="width:auto">
            <button class="btn ghost" id="pv-cancel" style="width:auto">ยกเลิก</button>
            <button class="btn primary" id="pv-confirm" style="width:auto">✔ ยืนยันบันทึก</button>
          </div>
        </div>
        <p class="hint">แก้ค่าในช่องได้เลย · ลบแถวที่ไม่ต้องการด้วยปุ่ม ✕ · เลขที่ RG ต้องอยู่ในรูปแบบ 000-0000-00000</p>
        <div class="table-scroll"><table class="otable pv-table"><thead><tr>
          ${cols.map(([, label, wd]) => `<th style="min-width:${wd}px">${label}</th>`).join('')}<th></th>
        </tr></thead><tbody></tbody></table></div>
        <div id="pv-msg" class="err"></div></div>`);
      const tb = $('tbody', card);
      // เก็บ object จริงไว้ (แก้ค่าลง object โดยตรง) — ลำดับตรงกับแถว
      const rows = headers.map((h) => ({ ...h }));
      rows.forEach((h) => tb.appendChild(makeRow(h, rows, tb, card)));
      $('#pv-cancel', card).onclick = () => { pv.innerHTML = ''; };
      $('#pv-confirm', card).onclick = async () => {
        const msg = $('#pv-msg', card);
        const live = rows.filter((r) => !r._deleted);
        if (!live.length) { msg.textContent = 'ไม่มีแถวเหลือให้บันทึก'; return; }
        const bad = live.filter((r) => !/^\d{3}-\d{4}-\d{4,}$/.test(String(r.rg_no || '').trim()));
        if (bad.length) { msg.textContent = `เลขที่ RG ผิดรูปแบบ ${bad.length} แถว — แก้ให้ถูกก่อนบันทึก`; return; }
        msg.textContent = ''; $('#pv-confirm', card).textContent = 'กำลังบันทึก…';
        try {
          const r = await api('/rg/import', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ format: 'summary', headers: live.map(stripMeta) }),
          });
          showResult(r);
        } catch (e) { msg.textContent = e.message; $('#pv-confirm', card).textContent = '✔ ยืนยันบันทึก'; }
      };
      pv.innerHTML = ''; pv.appendChild(card);

      function makeRow(h) {
        const tr = el('<tr></tr>');
        for (const [key, , wd] of cols) {
          const td = el('<td></td>');
          const inp = el(`<input class="in pv-in" value="${esc(h[key] ?? '')}" style="min-width:${wd - 16}px"/>`);
          if (['qty_boxes', 'qty_pieces'].includes(key)) inp.type = 'number';
          inp.oninput = () => { h[key] = inp.value; };
          td.appendChild(inp); tr.appendChild(td);
        }
        const del = el('<td class="edit"><button class="btn red" style="width:auto;padding:4px 8px">✕</button></td>');
        del.querySelector('button').onclick = () => { h._deleted = true; tr.remove(); $('#pv-count', card).textContent = rows.filter((r) => !r._deleted).length; };
        tr.appendChild(del);
        return tr;
      }
    }
    function stripMeta(h) { const { _deleted, ...rest } = h; return rest; }

    return w;
  },
};

// ---- Vendor: งานที่ได้รับมอบหมาย (กรอกวันที่รับจริง + วันนำกลับคลังจริง) ----
VIEWS.myjobs = {
  id: 'myjobs', label: 'งานของฉัน',
  render: () => {
    const w = el(`<div><div class="view wide"><h3>งานที่ได้รับมอบหมาย</h3>
      <p class="hint">เลือกหลายใบ → กรอกวันที่ด้านล่าง (ทำเสร็จแล้วค่อยกรอก) · แตะ ✏️ เพื่อคีย์รายใบ/พิมพ์ใบงาน</p>
      <div class="card">
        <div class="jfilters">
          <label class="jf jf-search"><span>ค้นหา (เว้นวรรค=ต้องมีทุกคำ · ,=อย่างใดอย่างหนึ่ง)</span>
            <input id="jsearch" class="in" placeholder="เช่น บางรัก ซีเจ, 010011 — RG/Sold To Code/ร้านค้า/อำเภอ/จังหวัด"/></label>
          <label class="jf"><span>สถานะ</span>
            <select id="jstatus" class="in"><option value="">ทุกสถานะ</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
          <label class="jf"><span>จัดกลุ่มตาม</span>
            <select id="jgrpby" class="in">${GROUP_FIELDS.map((g) => `<option value="${g.key}">${g.label}</option>`).join('')}</select></label>
        </div>
        <div class="row">
          <a class="btn ghost" id="jload" style="width:auto">⬇️ Load Data Excel</a>
          <input id="jfile" type="file" accept=".xlsx,.xls" class="in" style="flex:1"/>
          <button class="btn primary" id="jupload" style="width:auto">⬆️ Upload วันที่ + หมวด/เหตุผล</button>
        </div>
        <p class="hint">ไฟล์เดียวรวมทั้ง วันที่รับ/กลับคลัง และ หมวด/เหตุผล (1 ออเดอร์แตกได้หลายแถวตามจำนวนหมวด)
        · <b>Load Data Excel จะดึงตามตัวกรองด้านบน</b> (ค้นหา/สถานะ)</p>
        <div id="jmsg"></div>
      </div>
      <div id="jgroups"></div>
      <div id="jempty"></div>
    </div>
    <div class="assign-bar hidden" id="jbar">
      <span id="jcount" class="acount">0</span>
      <label class="jbar-f"><span>วันที่รับ</span>
        <input id="jbar-recv-date" type="date" class="in" max="${todayStr()}" title="วันที่รับสินค้าจริง (กรอกวันล่วงหน้าไม่ได้)"/></label>
      <label class="jbar-f"><span>วันกลับคลัง</span>
        <input id="jbar-ret-date" type="date" class="in" max="${todayStr()}" title="วันนำสินค้ากลับคืนคลังจริง (กรอกวันล่วงหน้าไม่ได้)"/></label>
      <label class="jbar-f"><span>หมวด</span>
        <select id="jbar-cat" class="in" title="หมวด">${['<option value="">— เลือกหมวด —</option>'].concat(NOTE_CATEGORIES.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`)).join('')}</select></label>
      <label class="jbar-f jbar-f-wide"><span>เหตุผล</span>
        <input id="jbar-rea" class="in" placeholder="เลือกหมวดแล้วต้องกรอก" title="เหตุผล"/></label>
      <button class="btn primary" id="jbar-save">💾 บันทึก</button>
    </div></div>`);

    let all = [], selected = new Set();

    async function loadOrders() {
      const box = $('#jgroups', w); box.innerHTML = '<div class="empty">กำลังโหลด…</div>';
      all = []; let page = 1, total = Infinity;
      const q = $('#jsearch', w).value.trim();
      const status = $('#jstatus', w).value;
      while (all.length < total && page <= 20) {
        const r = await fetchOrders({ pageSize: 100, page, q, ...(status ? { status } : {}) });
        all.push(...r.data); total = r.total; if (!r.data.length) break; page++;
      }
      selected.clear(); updateBar();
      render();
    }

    function render() {
      const box = $('#jgroups', w); box.innerHTML = '';
      if (!all.length) { $('#jempty', w).innerHTML = '<div class="empty">ยังไม่มีงานที่ได้รับมอบหมาย</div>'; return; }
      $('#jempty', w).innerHTML = '';
      const gk = $('#jgrpby', w).value;
      const groups = new Map();
      for (const o of all) {
        const key = gk ? (o[gk] || '(ไม่ระบุ)') : '__all__';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(o);
      }
      for (const [key, items] of groups) {
        const g = el(`<div class="agroup card">
          ${gk ? `<div class="agroup-head"><label class="chk"><input type="checkbox" class="gsel"/> <b>${esc(key)}</b> <span class="hint">(${items.length})</span></label></div>` : ''}
          <div class="agroup-body"></div></div>`);
        const body = $('.agroup-body', g);
        const tblWrap = el(`<div class="table-scroll"><table class="otable">
          <thead><tr>
            <th><input type="checkbox" class="selall" title="เลือกทั้งหมด"/></th>
            <th>เลขที่ RG</th><th>สถานะ</th><th>เขต</th><th class="code">Sold To Code</th><th class="code">Ship To</th><th>Sold To</th>
            <th>อำเภอ</th><th>จังหวัด</th>
            <th class="num">กล่อง</th>
            <th class="dt">วันที่พิมพ์</th><th class="dt">วันที่มอบหมาย</th><th class="dt">วันที่รับ</th><th class="dt">วันกลับคลัง</th><th></th>
          </tr></thead><tbody></tbody></table></div>`);
        const tb = $('tbody', tblWrap);
        items.forEach((o) => {
          const dcell = (v) => v ? `<td class="dt">${fmtDate(v)}</td>` : '<td class="dt"><span class="muted">-</span></td>';
          const tr = el(`<tr class="${selected.has(o.rg_no) ? 'on' : ''}">
            <td><input type="checkbox" class="osel" ${selected.has(o.rg_no) ? 'checked' : ''}/></td>
            <td class="no">${esc(o.rg_no)}</td>
            <td>${statusChip(o.status)}</td>
            <td>${esc(o.zone || '-')}</td>
            <td class="code">${esc(o.sold_to_code || '-')}</td>
            <td class="code">${esc(o.sold_to || '-')}</td>
            <td class="l soldto">${esc(o.sold_to_name || '-')}</td>
            <td>${esc(o.district || '-')}</td>
            <td>${esc(o.province || '-')}</td>
            <td class="num">${o.qty_boxes ?? 0}</td>
            ${dcell(o.rg_date)}${dcell(o.assigned_at)}${dcell(o.received_date)}${dcell(o.returned_date)}
            <td class="edit">✏️</td></tr>`);
          const cb = $('.osel', tr);
          const setRow = () => { cb.checked ? selected.add(o.rg_no) : selected.delete(o.rg_no); tr.classList.toggle('on', cb.checked); syncGroupChk(g, items); syncSelAll(); updateBar(); };
          cb.onchange = setRow;
          tr.onclick = (e) => {
            if (e.target.classList.contains('edit') || e.target.closest('.edit')) { openVendorJob(o, loadOrders); return; }
            if (e.target !== cb) { cb.checked = !cb.checked; setRow(); }
          };
          tb.appendChild(tr);
        });
        const selall = $('.selall', tblWrap);
        const syncSelAll = () => {
          const on = items.filter((o) => selected.has(o.rg_no)).length;
          selall.checked = on === items.length && on > 0;
          selall.indeterminate = on > 0 && on < items.length;
        };
        syncSelAll();
        selall.onchange = () => {
          items.forEach((o) => selall.checked ? selected.add(o.rg_no) : selected.delete(o.rg_no));
          render(); updateBar();
        };
        const gsel = $('.gsel', g);
        if (gsel) {
          syncGroupChk(g, items);
          gsel.onchange = () => {
            items.forEach((o) => gsel.checked ? selected.add(o.rg_no) : selected.delete(o.rg_no));
            render(); updateBar();
          };
        }
        body.appendChild(tblWrap);
        box.appendChild(g);
      }
    }

    function syncGroupChk(g, items) {
      const gsel = $('.gsel', g); if (!gsel) return;
      const on = items.filter((o) => selected.has(o.rg_no)).length;
      gsel.checked = on === items.length && on > 0;
      gsel.indeterminate = on > 0 && on < items.length;
    }

    function updateBar() {
      $('#jcount', w).textContent = selected.size;
      $('#jbar', w).classList.toggle('hidden', selected.size === 0);
    }

    // ⬇️ Load Data Excel — ไฟล์เดียว: วันที่รับ/กลับคลัง + หมวด/เหตุผล
    //    Export ตาม filter ปัจจุบัน (สถานะ/ค้นหา) — คำนวณ href ตอนกดเพื่อให้ได้ค่าล่าสุดเสมอ
    $('#jload', w).setAttribute('download', '');
    const syncLoadHref = () => {
      const p = new URLSearchParams();
      const st = $('#jstatus', w).value, qq = $('#jsearch', w).value.trim();
      if (st) p.set('status', st);
      if (qq) p.set('q', qq);
      const qs = p.toString();
      $('#jload', w).href = withToken('/api/orders/vendor-template' + (qs ? '?' + qs : ''));
    };
    syncLoadHref();
    $('#jload', w).addEventListener('mousedown', syncLoadHref); // อัปเดตก่อน browser ตาม href

    // ⬆️ Upload ไฟล์เดียว: อัปเดตวันที่ + แทนที่หมวด/เหตุผล
    $('#jupload', w).onclick = async () => {
      const f = $('#jfile', w).files[0], out = $('#jmsg', w);
      if (!f) { out.innerHTML = '<p class="err">กรุณาเลือกไฟล์ (ใช้ไฟล์จากปุ่ม Load Data Excel แล้วกรอกวันที่/หมวด)</p>'; return; }
      out.innerHTML = 'กำลังอัปโหลด…';
      const fd = new FormData(); fd.append('file', f);
      try {
        const r = await api('/orders/vendor-import', { method: 'POST', body: fd });
        const badDates = r.bad_dates || [];
        out.innerHTML = `<p class="ok">บันทึกวันที่ ${r.updated} รายการ`
          + ` · หมวด+เหตุผล ${r.notes_updated} ออเดอร์ (${r.notes_saved} แถว)`
          + (r.locked ? ` · <span class="err">ปิดงานแล้วแก้ไม่ได้ ${r.locked}</span>` : '')
          + (r.bad_rows ? ` · <span class="err">ข้ามแถวไม่ครบ ${r.bad_rows}</span>` : '')
          + (badDates.length ? ` · <span class="err">ข้ามวันที่ผิดลำดับ ${badDates.length}</span>` : '')
          + (r.not_mine ? ` · <span class="err">ไม่ใช่งานของคุณ ${r.not_mine}</span>` : '') + '</p>'
          + (badDates.length ? `<ul class="err" style="margin:6px 0 0 18px">${badDates.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : '');
        $('#jfile', w).value = '';
        await loadOrders();
      } catch (e) { out.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
    };

    // บันทึกวันที่ ทีละหลายใบ (งานที่ปิดแล้วระบบจะไม่แก้ให้) — คืนผลให้ผู้เรียกไปรวมข้อความเอง
    const bulkDates = async (body) => api('/orders/bulk-vendor-dates', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rg_nos: [...selected], ...body }),
    });

    // ล้างช่องกรอกกลับเป็นค่าเริ่มต้นหลังบันทึกสำเร็จ
    const clearBarInputs = () => {
      $('#jbar-recv-date', w).value = '';
      $('#jbar-ret-date', w).value = '';
      $('#jbar-cat', w).value = '';
      const rea = $('#jbar-rea', w); rea.value = ''; rea.classList.remove('req');
    };

    // ปุ่มเดียวบันทึกทั้ง 4 ค่า — ช่องไหนไม่กรอกก็ข้ามไป ไม่ไปทับค่าเดิมในฐานข้อมูล
    $('#jbar-save', w).onclick = async () => {
      const recv = $('#jbar-recv-date', w).value;
      const ret = $('#jbar-ret-date', w).value;
      const category = $('#jbar-cat', w).value.trim();
      const rea = $('#jbar-rea', w);
      const reason = rea.value.trim();

      if (!recv && !ret && !category && !reason) { toast('กรุณากรอกอย่างน้อย 1 ช่อง'); return; }
      const today = todayStr();
      if (recv && recv > today) { toast('วันที่รับ: กรอกวันล่วงหน้าไม่ได้ — ทำเสร็จแล้วค่อยกรอก'); return; }
      if (ret && ret > today) { toast('วันกลับคลัง: กรอกวันล่วงหน้าไม่ได้ — ทำเสร็จแล้วค่อยกรอก'); return; }
      // หมวด/เหตุผลต้องมาคู่กันเสมอ
      if (reason && !category) { toast('กรุณาเลือกหมวด'); return; }
      if (category && !reason) { rea.classList.add('req'); rea.focus(); toast('เลือกหมวดแล้วต้องกรอกเหตุผล'); return; }
      rea.classList.remove('req');

      const btn = $('#jbar-save', w); btn.disabled = true;
      const msgs = [];
      let badDates = [];
      try {
        if (recv || ret) {
          const r = await bulkDates({ ...(recv ? { received_date: recv } : {}), ...(ret ? { returned_date: ret } : {}) });
          badDates = r.bad_dates || [];
          msgs.push(`วันที่ ${r.updated} รายการ`
            + (r.locked ? ` (ข้ามงานปิดแล้ว ${r.locked})` : '')
            + (badDates.length ? ` (ข้ามวันที่ผิดลำดับ ${badDates.length})` : ''));
        }
        if (category && reason) {
          const r = await api('/orders/bulk-vendor-notes', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rg_nos: [...selected], rows: [{ category, reason }] }),
          });
          msgs.push(`หมวด+เหตุผล ${r.updated} รายการ` + (r.not_mine ? ` (ข้ามไม่ใช่งานคุณ ${r.not_mine})` : ''));
        }
        toast('บันทึกสำเร็จ · ' + msgs.join(' · '));
        if (badDates.length) openModal(`<div class="d-no">⚠️ ข้ามวันที่ผิดลำดับ ${badDates.length} ออเดอร์</div>
          <p class="hint">กติกา: วันที่รับสินค้า ≥ วันมอบหมาย · วันกลับคลัง ≥ วันรับสินค้า</p>
          <ul class="err" style="margin:6px 0 0 18px">${badDates.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`);
        clearBarInputs();
        await loadOrders();   // ล้างรายการที่เลือก + ดึงข้อมูลใหม่
      } catch (e) {
        toast('ผิดพลาด: ' + e.message);   // ไม่ล้างช่อง — ผู้ใช้จะได้กดซ้ำได้เลย
      } finally { btn.disabled = false; }
    };
    $('#jbar-cat', w).onchange = () => {
      const rea = $('#jbar-rea', w);
      rea.classList.toggle('req', !!$('#jbar-cat', w).value && !rea.value.trim());
      if ($('#jbar-cat', w).value) rea.focus();
    };
    $('#jbar-rea', w).oninput = () => $('#jbar-rea', w).classList.remove('req');

    $('#jgrpby', w).onchange = render;
    $('#jstatus', w).onchange = () => { syncLoadHref(); loadOrders(); };
    let t; $('#jsearch', w).oninput = () => { syncLoadHref(); clearTimeout(t); t = setTimeout(loadOrders, 400); };

    loadOrders();
    return w;
  },
};

async function openVendorJob(o, reload) {
  openModal(orderDetailHtml(o) + `
    <div class="actions">
      <a class="btn ghost" href="${withToken('/api/pdf/' + encodeURIComponent(o.rg_no) + '/transport')}" target="_blank">🖨️ ใบขนส่ง</a>
      <a class="btn ghost" href="${withToken('/api/pdf/' + encodeURIComponent(o.rg_no) + '/receipt')}" target="_blank">🖨️ ใบรับคืน</a>
    </div>
    <hr/>
    ${o.status === 'completed'
      ? '<p class="hint">🔒 งานปิดแล้ว — แก้ไขวันที่ไม่ได้</p>'
      : `<label class="hint">วันที่รับสินค้าจริง</label>
    <div class="row"><input id="rdate" type="date" class="in" max="${todayStr()}" value="${o.received_date ? String(o.received_date).slice(0,10) : ''}"/>
    <button class="btn primary" id="brecv" style="width:auto">บันทึกรับ</button></div>
    <label class="hint">วันนำสินค้ากลับคืนคลังจริง</label>
    <div class="row"><input id="tdate" type="date" class="in" max="${todayStr()}" value="${o.returned_date ? String(o.returned_date).slice(0,10) : ''}"/>
    <button class="btn red" id="bret" style="width:auto">บันทึกกลับคลัง</button></div>`}
    <hr/>
    <div class="row" style="justify-content:space-between;align-items:center">
      <label class="hint" style="margin:0">หมวด + เหตุผล (เลือกหมวดแล้วต้องกรอกเหตุผล)</label>
      <button class="btn ghost" id="n-add" style="width:auto">＋ เพิ่มแถว</button>
    </div>
    <div class="table-scroll"><table class="otable" id="ntbl">
      <thead><tr><th style="width:38%">หมวด</th><th>เหตุผล</th><th style="width:34px"></th></tr></thead>
      <tbody></tbody></table></div>
    <div class="row"><button class="btn primary" id="n-save" style="width:auto">บันทึกหมวด+เหตุผล</button><div id="n-msg" class="hint" style="align-self:center"></div></div>
    <div id="m-err" class="err"></div>`);
  const save = (body) => async () => {
    try {
      await api(`/orders/${encodeURIComponent(o.rg_no)}/vendor-dates`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body()),
      });
      closeModal(); reload();
    } catch (e) { $('#m-err').textContent = e.message; }
  };
  const brecv = $('#brecv');
  if (brecv) brecv.onclick = save(() => ({ received_date: $('#rdate').value || undefined }));
  const bret = $('#bret');
  if (bret) bret.onclick = save(() => ({ returned_date: $('#tdate').value || undefined }));

  // ---- ตารางหมวด+เหตุผล (add/remove แถวได้) ----
  const ntb = $('#ntbl tbody');
  const optHtml = (sel) => ['<option value="">— เลือกหมวด —</option>']
    .concat(NOTE_CATEGORIES.map((c) => `<option value="${esc(c)}" ${c === sel ? 'selected' : ''}>${esc(c)}</option>`)).join('');
  function addRow(category = '', reason = '') {
    const tr = el(`<tr>
      <td><select class="in n-cat">${optHtml(category)}</select></td>
      <td><input class="in n-rea" placeholder="กรอกเหตุผล" value="${esc(reason)}"/></td>
      <td><button class="btn red n-del" style="width:auto;padding:4px 8px" title="ลบแถว">✕</button></td></tr>`);
    const rea = $('.n-rea', tr), cat = $('.n-cat', tr);
    // เลือกหมวดแล้ว = บังคับกรอกเหตุผล
    cat.onchange = () => { rea.classList.toggle('req', !!cat.value && !rea.value.trim()); if (cat.value) rea.focus(); };
    rea.oninput = () => rea.classList.remove('req');
    $('.n-del', tr).onclick = () => tr.remove();
    ntb.appendChild(tr);
    return tr;
  }
  $('#n-add').onclick = () => addRow();

  $('#n-save').onclick = async () => {
    const rows = [];
    for (const tr of ntb.querySelectorAll('tr')) {
      const category = $('.n-cat', tr).value.trim();
      const reason = $('.n-rea', tr).value.trim();
      if (!category && !reason) continue;
      if (category && !reason) { $('.n-rea', tr).classList.add('req'); $('#n-msg').innerHTML = '<span class="err">เลือกหมวดแล้วต้องกรอกเหตุผล</span>'; return; }
      if (!category && reason) { $('#n-msg').innerHTML = '<span class="err">กรุณาเลือกหมวดให้ครบ</span>'; return; }
      rows.push({ category, reason });
    }
    $('#n-msg').textContent = 'กำลังบันทึก…';
    try {
      const r = await api(`/orders/${encodeURIComponent(o.rg_no)}/vendor-notes`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      $('#n-msg').innerHTML = `<span class="ok">บันทึก ${r.saved} แถว</span>`;
    } catch (e) { $('#n-msg').innerHTML = `<span class="err">${esc(e.message)}</span>`; }
  };

  // โหลดหมวด+เหตุผลเดิม
  try {
    const notes = await api(`/orders/${encodeURIComponent(o.rg_no)}/vendor-notes`);
    if (notes.length) notes.forEach((n) => addRow(n.category, n.reason));
    else addRow();
  } catch { addRow(); }
}

// ---- GR: Upload ReportRG ปิดงานอัตโนมัติ ----
VIEWS.grimport = {
  id: 'grimport', label: 'Upload ไฟล์ปิดงาน',
  render: () => {
    const w = el(`<div class="view"><div class="card">
      <h3>Upload file รับสินค้าเข้าระบบ (ReportRG / ไฟล์ปิดงาน .xlsx)</h3>
      <p class="hint">ระบบจับคู่ด้วย "เลขที่ RG" — แถวที่มีวันปิดงาน ("วันที่สร้าง Doc. WH" หรือ "ว.ด.ปี ที่ Complete") = สินค้าเข้าคลังแล้ว<br>
        · <b>ไม่มี Remark</b> → ปิดงานอัตโนมัติ &nbsp;·&nbsp; <b>มี Remark</b> → <span class="chip st st-gr_received">รับสินค้าเข้าระบบ</span> รอเคลียร์ Remark ก่อนปิดงาน</p>
      <input id="gfile" type="file" accept=".xlsx,.xls" class="in" />
      <button id="gup" class="btn primary">อัปโหลด & ปิดงาน</button>
      <div id="gout"></div></div></div>`);
    $('#gup', w).onclick = async () => {
      const f = $('#gfile', w).files[0], out = $('#gout', w);
      if (!f) { out.innerHTML = '<p class="err">กรุณาเลือกไฟล์</p>'; return; }
      out.innerHTML = 'กำลังอัปโหลด…';
      const fd = new FormData(); fd.append('file', f);
      try {
        const r = await api('/orders/gr-import', { method: 'POST', body: fd });
        out.innerHTML = `<p class="ok">✅ ปิดงาน ${r.completed} รายการ · รายการสินค้า ${r.items} แถว</p>`
          + (r.gr_received ? `<p class="ok">📦 รับสินค้าเข้าระบบ (มี Remark) ${r.gr_received} รายการ — ยังไม่ปิดงาน ดูที่แท็บ "รับสินค้าเข้าระบบ"</p>` : '')
          + (r.already_completed ? `<p class="hint">ปิดไปก่อนแล้ว ${r.already_completed} รายการ</p>` : '')
          + (r.skipped_new ? `<p class="err">⏭️ ข้าม ${r.skipped_new} เลขที่ RG ที่ไม่มีในระบบ</p>` : '')
          + (r.no_doc_date ? `<p class="err">⏳ ยังไม่มีวันที่สร้าง Doc. WH (ยังไม่เข้าคลัง) ${r.no_doc_date} รายการ</p>` : '');
        $('#gfile', w).value = '';
      } catch (e) { out.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
    };
    return w;
  },
};

// ---- GR: รับสินค้าเข้าระบบ (งานที่ยังไม่ปิด) ----
VIEWS.grlist = {
  id: 'grlist', label: 'รับสินค้าเข้าระบบ',
  render: () => listView({
    title: 'รับสินค้าเข้าระบบ',
    hint: 'งานที่ยังไม่ปิด — "นำกลับคลังแล้ว" รอเข้าคลัง · "รับสินค้าเข้าระบบ" = เข้าคลังแล้วแต่ติด Remark ต้องเคลียร์ก่อนปิดงาน · แตะแถวเพื่อดู/ปิดงานรายใบ',
    wide: true,
    params: () => ({
      status: $('#gstatus')?.value ?? 'returned,gr_received',
      area: $('#gq-area')?.value.trim() || '', q: $('#gq')?.value.trim() || '',
    }),
    filters: (reload) => {
      const f = el(`<div class="jfilters">
        <label class="jf jf-search"><span>ค้นหา (เว้นวรรค=ต้องมีทุกคำ · ,=อย่างใดอย่างหนึ่ง)</span>
          <input id="gq" class="in" placeholder="เช่น บางรัก ซีเจ, 010011 — RG/Sold To Code/ร้านค้า/อำเภอ/จังหวัด"/></label>
        <label class="jf"><span>สถานะ</span>
          <select id="gstatus" class="in"><option value="returned,gr_received" selected>ยังไม่ปิดงาน (กลับคลัง + รับเข้าระบบ)</option>
            <option value="">ทุกสถานะ</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
        <label class="jf"><span>พื้นที่</span>
          <input id="gq-area" class="in" placeholder="เช่น กรุงเทพ"/></label>
        <button class="btn primary jf-btn" id="gsearch">ค้นหา</button>
        <button class="btn ghost jf-btn" id="gexport">⬇️ Export Excel</button></div>`);
      $('#gsearch', f).onclick = reload;
      $('#gstatus', f).onchange = reload;
      let t;
      $('#gq', f).oninput = () => { clearTimeout(t); t = setTimeout(reload, 400); };
      $('#gq-area', f).oninput = () => { clearTimeout(t); t = setTimeout(reload, 400); };
      // Export ตาม filter ปัจจุบัน (default สถานะ = returned)
      $('#gexport', f).onclick = () => {
        const p = new URLSearchParams();
        const st = $('#gstatus', f).value, ar = $('#gq-area', f).value.trim(), qq = $('#gq', f).value.trim();
        if (st) p.set('status', st); if (ar) p.set('area', ar); if (qq) p.set('q', qq);
        window.open(withToken('/api/dashboard/export?' + p.toString()), '_blank');
      };
      return f;
    },
    renderRows: (data, reload) => {
      const selected = new Set();
      const wrap = el('<div></div>');
      const bar = el(`<div class="assign-bar hidden">
        <span class="acount">0</span>
        <button class="btn red" style="width:auto">✅ ปิดงานที่เลือก</button></div>`);
      const count = $('.acount', bar), btn = $('button', bar);
      const updateBar = () => { count.textContent = selected.size; bar.classList.toggle('hidden', selected.size === 0); };
      const table = ordersTable(data, (o) => openGrComplete(o, reload), { selected, onChange: updateBar });
      btn.onclick = async () => {
        if (!selected.size) return;
        if (!confirm(`ปิดงาน ${selected.size} ออเดอร์ที่เลือก?`)) return;
        btn.disabled = true;
        try {
          const r = await api('/orders/bulk-complete', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rg_nos: [...selected] }),
          });
          toast(`ปิดงาน ${r.completed} รายการ` + (r.already_completed ? ` (ปิดไปแล้ว ${r.already_completed})` : ''));
          reload();
        } catch (e) { toast('ผิดพลาด: ' + e.message); btn.disabled = false; }
      };
      wrap.appendChild(table); wrap.appendChild(bar);
      return wrap;
    },
  }),
};

function openGrComplete(o, reload) {
  openModal(orderDetailHtml(o) + `
    ${o.status === 'gr_received' ? `<div class="vchg-warn">📦 สินค้าเข้าคลังแล้ว (${fmtDate(o.gr_received_date)}) แต่ติด Remark —
      ตรวจสอบและเคลียร์ Remark ให้เรียบร้อยก่อนกดปิดงาน</div>` : ''}
    <hr/><label class="hint">แนบเอกสาร (ไม่บังคับ) แล้วปิดงานรายใบ — หรือใช้แท็บ "Upload ไฟล์ปิดงาน" เพื่อปิดจากไฟล์ ReportRG</label>
    <input id="cfile" type="file" class="in"/>
    <button class="btn red" id="done">ปิดงาน</button>
    <div id="m-err" class="err"></div>`);
  $('#done').onclick = async () => {
    const f = $('#cfile').files[0];
    const fd = new FormData(); if (f) fd.append('file', f);
    try {
      await api(`/orders/${encodeURIComponent(o.rg_no)}/complete`, { method: 'POST', body: fd });
      closeModal(); reload();
    } catch (e) { $('#m-err').textContent = e.message; }
  };
}

// ---- Supervisor/Admin: all orders (view/edit) ----
VIEWS.orders = {
  id: 'orders', label: 'ออเดอร์ทั้งหมด',
  render: () => {
    // เปลี่ยน Vendor ได้ 2 ทาง: ปุ่ม 🔄 ในคอลัมน์ Vendor (รายใบ) หรือ ติ๊กหลายใบ → แถบด้านล่าง (ทีเดียวหลายใบ)
    const selected = new Set();
    const box = el('<div></div>');
    const bar = el(`<div class="assign-bar hidden" id="obar">
      <span id="ocount" class="acount">0</span>
      <select id="obar-vendor" class="in"></select>
      <button class="btn red" id="obar-go">เปลี่ยน Vendor ที่เลือก</button>
      <button class="btn ghost" id="obar-clear">ยกเลิก</button>
    </div>`);
    $('#obar-vendor', bar).innerHTML = VENDOR_LIST.length
      ? VENDOR_LIST.map((v) => `<option value="${v.id}">${esc(v.display_name)}</option>`).join('')
      : '<option value="">— ยังไม่มี Vendor —</option>';

    const updateBar = () => {
      $('#ocount', bar).textContent = selected.size;
      bar.classList.toggle('hidden', selected.size === 0);
    };
    // reload ของ listView — เซ็ตหลัง list ถูกสร้าง
    let reloadList = () => {};

    $('#obar-clear', bar).onclick = () => { selected.clear(); reloadList(); };
    $('#obar-go', bar).onclick = async () => {
      const vendor_id = Number($('#obar-vendor', bar).value);
      if (!vendor_id) { toast('ยังไม่มี Vendor ให้เลือก'); return; }
      if (!confirm(`เปลี่ยน Vendor ของ ${selected.size} ออเดอร์ เป็น "${vendorLabel(vendor_id)}" ?`)) return;
      try {
        const r = await api('/orders/bulk-assign-vendor', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rg_nos: [...selected], vendor_id }),
        });
        toast(`เปลี่ยน Vendor สำเร็จ ${r.assigned} รายการ`
          + (r.skipped ? ` · ข้าม ${r.skipped} รายการ (ปิดงานแล้ว/Vendor เดิม)` : ''));
        selected.clear(); updateBar(); reloadList();
      } catch (e) { toast('ผิดพลาด: ' + e.message); }
    };

    const list = listView({
    title: 'ออเดอร์ทั้งหมด',
    hint: 'ค้นหา/กรอง · แตะแถวเพื่อดู/แก้ไขทุกช่อง · กด 🔄 ที่คอลัมน์ Vendor เพื่อเปลี่ยนรายใบ หรือติ๊กหลายใบแล้วเปลี่ยนพร้อมกันด้านล่าง',
    wide: true,
    params: () => ({ status: $('#fstatus')?.value || '', area: $('#farea')?.value.trim() || '', q: $('#fq')?.value.trim() || '' }),
    filters: (reload) => {
      const f = el(`<div class="jfilters">
        <label class="jf jf-search"><span>ค้นหา (เว้นวรรค=ต้องมีทุกคำ · ,=อย่างใดอย่างหนึ่ง)</span>
          <input id="fq" class="in" placeholder="เช่น บางรัก ซีเจ, 010011 — RG/Sold To Code/ร้านค้า/อำเภอ/จังหวัด"/></label>
        <label class="jf"><span>สถานะ</span>
          <select id="fstatus" class="in"><option value="">ทุกสถานะ</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
        <label class="jf"><span>พื้นที่</span>
          <input id="farea" class="in" placeholder="เช่น กรุงเทพ"/></label>
        <button class="btn primary jf-btn" id="fsearch">ค้นหา</button>
        <button class="btn ghost jf-btn" id="fexport">⬇️ Export Excel</button></div>`);
      $('#fsearch', f).onclick = reload;
      $('#fstatus', f).onchange = reload;
      let t;
      $('#fq', f).oninput = () => { clearTimeout(t); t = setTimeout(reload, 400); };
      $('#farea', f).oninput = () => { clearTimeout(t); t = setTimeout(reload, 400); };
      // Export ตาม filter ปัจจุบัน (สถานะ/พื้นที่/ค้นหา)
      $('#fexport', f).onclick = () => {
        const p = new URLSearchParams();
        const st = $('#fstatus', f).value, ar = $('#farea', f).value.trim(), qq = $('#fq', f).value.trim();
        if (st) p.set('status', st); if (ar) p.set('area', ar); if (qq) p.set('q', qq);
        window.open(withToken('/api/dashboard/export?' + p.toString()), '_blank');
      };
      return f;
    },
    renderRows: (data, reload) => {
      reloadList = reload;
      // ล้างรายการที่เลือกไว้แต่ไม่อยู่ในหน้านี้แล้ว — กันเผลอเปลี่ยน Vendor ใบที่มองไม่เห็น
      const visible = new Set(data.map((o) => o.rg_no));
      [...selected].forEach((rg) => { if (!visible.has(rg)) selected.delete(rg); });
      updateBar();
      return ordersTable(data, (o) => openSupervisorEdit(o, reload),
        { selected, onChange: updateBar },
        { onVendorChange: (o) => openVendorChange(o, reload) });
    },
    });

    box.appendChild(list);
    box.appendChild(bar);
    return box;
  },
};

// ตารางรายละเอียดออเดอร์ครบทุกคอลัมน์ + 5 วันที่ (ใช้ร่วมหลายหน้า)
//   select (ทางเลือก): { selected:Set<rg_no>, onChange() } — เปิดคอลัมน์ checkbox + เลือกทั้งหมด
//   opt.onVendorChange (ทางเลือก): (order) => {} — เปิดคอลัมน์ Vendor + ปุ่มเปลี่ยน Vendor รายใบ
function ordersTable(data, onRowClick, select, opt = {}) {
  const withVendor = !!opt.onVendorChange;
  const dcell = (v) => v ? `<td class="dt">${fmtDate(v)}</td>` : '<td class="dt"><span class="muted">-</span></td>';
  // สินค้าเข้าคลัง/ปิดงานแล้วห้ามเปลี่ยน Vendor (ตรงกับ REASSIGNABLE ฝั่ง API)
  const canChange = (o) => !['gr_received', 'completed'].includes(o.status);
  const vcell = (o) => {
    const name = vendorLabel(o.vendor_id);
    const body = name
      ? `<span class="vname">${esc(name)}</span>`
      : '<span class="vname none">ยังไม่มอบหมาย</span>';
    const btn = canChange(o)
      ? `<button class="vchg" title="เปลี่ยน Vendor">🔄</button>`
      : '';
    return `<td class="vend">${body}${btn}</td>`;
  };
  const wrap = el(`<div class="table-scroll"><table class="otable">
    <thead><tr>
      ${select ? '<th><input type="checkbox" class="selall" title="เลือกทั้งหมด"/></th>' : ''}
      <th class="no">เลขที่ RG</th><th class="st">สถานะ</th>${withVendor ? '<th class="vend">Vendor</th>' : ''}<th>เขต</th><th class="code">Sold To Code</th><th class="code">Ship To</th><th>Sold To</th><th>จังหวัด</th>
      <th class="num">กล่อง</th><th class="num">ชิ้น</th>
      <th class="dt">วันที่พิมพ์</th><th class="dt">มอบหมาย</th><th class="dt">รับสินค้า</th><th class="dt">กลับคลัง</th><th class="dt">ปิดงาน</th><th></th>
    </tr></thead><tbody></tbody></table></div>`);
  const tb = $('tbody', wrap);
  const selall = select ? $('.selall', wrap) : null;
  const syncSelAll = () => {
    if (!selall) return;
    const on = data.filter((o) => select.selected.has(o.rg_no)).length;
    selall.checked = on === data.length && on > 0;
    selall.indeterminate = on > 0 && on < data.length;
  };
  data.forEach((o) => {
    const tr = el(`<tr class="${select && select.selected.has(o.rg_no) ? 'on' : ''}">
      ${select ? `<td><input type="checkbox" class="osel" ${select.selected.has(o.rg_no) ? 'checked' : ''}/></td>` : ''}
      <td class="no">${esc(o.rg_no)}</td>
      <td class="st">${statusChip(o.status)}</td>
      ${withVendor ? vcell(o) : ''}
      <td>${esc(o.zone || '-')}</td>
      <td class="code">${esc(o.sold_to_code || '-')}</td>
      <td class="code">${esc(o.sold_to || '-')}</td>
      <td class="l soldto">${esc(o.sold_to_name || '-')}</td>
      <td>${esc(o.province || '-')}</td>
      <td class="num">${o.qty_boxes ?? 0}</td>
      <td class="num">${o.qty_pieces ?? 0}</td>
      ${dcell(o.rg_date)}${dcell(o.assigned_at)}${dcell(o.received_date)}${dcell(o.returned_date)}${dcell(o.completed_date)}
      <td class="edit">✏️</td></tr>`);
    // ปุ่มเปลี่ยน Vendor — กันไม่ให้ไปเปิดโมดัลแก้ไข/ติ๊ก checkbox ของแถว
    const vbtn = withVendor ? $('.vchg', tr) : null;
    if (vbtn) vbtn.onclick = (e) => { e.stopPropagation(); opt.onVendorChange(o); };
    if (select) {
      const cb = $('.osel', tr);
      const setRow = () => { cb.checked ? select.selected.add(o.rg_no) : select.selected.delete(o.rg_no); tr.classList.toggle('on', cb.checked); syncSelAll(); select.onChange(); };
      cb.onchange = setRow;
      tr.onclick = (e) => {
        if (e.target.classList.contains('edit') || e.target.closest('.edit')) { onRowClick(o); return; }
        if (e.target !== cb) { cb.checked = !cb.checked; setRow(); }
      };
    } else {
      tr.onclick = () => onRowClick(o);
    }
    tb.appendChild(tr);
  });
  if (selall) {
    syncSelAll();
    selall.onchange = () => {
      data.forEach((o) => selall.checked ? select.selected.add(o.rg_no) : select.selected.delete(o.rg_no));
      wrap.querySelectorAll('.osel').forEach((cb) => { cb.checked = selall.checked; cb.closest('tr').classList.toggle('on', selall.checked); });
      select.onChange();
    };
  }
  return wrap;
}

// ไทม์ไลน์วันที่ครบทุกช่วงในระบบ (read-only) — เรียงตามลำดับการทำงานจริง
function dateTimelineHtml(o) {
  const steps = [
    ['rg_date', 'วันที่พิมพ์', 'สร้างออเดอร์จากรายงาน', '📄'],
    ['assigned_at', 'วันที่มอบหมาย', 'จัดพื้นที่ให้ Vendor', '📌'],
    ['received_date', 'วันที่รับสินค้า', 'Vendor เข้ารับสินค้า', '📥'],
    ['returned_date', 'วันกลับคลัง', 'นำสินค้ากลับคืนคลัง', '🔄'],
    ['completed_date', 'วันปิดงาน', 'สินค้าเข้าคลัง (Doc. WH)', '✅'],
  ];
  const rows = steps.map(([k, label, sub, icon]) => {
    const done = !!o[k];
    return `<li class="tl-item ${done ? 'is-done' : 'is-wait'}">
      <span class="tl-dot">${done ? icon : ''}</span>
      <span class="tl-body"><span class="tl-label">${label}</span><span class="tl-sub">${sub}</span></span>
      <span class="tl-date">${done ? fmtDate(o[k]) : 'ยังไม่ถึงขั้นตอนนี้'}</span></li>`;
  }).join('');
  return `<div class="tl-card"><div class="tl-head">ไทม์ไลน์วันที่ทั้งหมด</div><ul class="tl">${rows}</ul></div>`;
}

function openSupervisorEdit(o, reload) {
  const fields = [
    ['sold_to_name', 'ร้านค้า'], ['ship_to_name', 'ที่อยู่ส่ง'], ['qty_boxes', 'กล่อง'], ['qty_pieces', 'ชิ้น'],
    ['wh_code', 'WH'], ['reason_text', 'เหตุผล'], ['contact_name', 'ผู้ติดต่อ'], ['contact_phone', 'เบอร์'],
    ['received_date', 'วันที่รับสินค้า (yyyy-mm-dd)'], ['returned_date', 'วันกลับคลัง (yyyy-mm-dd)'], ['completed_date', 'วันปิดงาน (yyyy-mm-dd)'],
    ['gr_remark', 'Remark (คลัง) — ลบออกเมื่อเคลียร์แล้ว'],
  ];
  openModal(`<div class="d-no">${esc(o.rg_no)} — แก้ไข</div>
    ${dateTimelineHtml(o)}
    <div class="tl-divider">แก้ไขข้อมูล</div>
    ${fields.map(([k, l]) => `<label class="hint">${l}</label><input class="in" data-k="${k}" value="${esc(o[k] ?? '')}"/>`).join('')}
    <label class="hint">สถานะ</label>
    <select class="in" data-k="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <button class="btn primary" id="save">บันทึก</button><div id="m-err" class="err"></div>`);
  $('#save').onclick = async () => {
    const patch = {};
    document.querySelectorAll('#modal-body [data-k]').forEach((i) => {
      let v = i.value; if (['qty_boxes', 'qty_pieces'].includes(i.dataset.k)) v = Number(v) || 0;
      patch[i.dataset.k] = v;
    });
    try {
      await api('/orders/' + encodeURIComponent(o.rg_no), {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      });
      closeModal(); reload();
    } catch (e) { $('#m-err').textContent = e.message; }
  };
}

// เปลี่ยน Vendor รายใบ — โมดัลสั้นๆ เลือกแล้วบันทึกจบ ไม่ต้องเข้าฟอร์มแก้ไขเต็ม
//   งานที่เลยขั้น "มอบหมายแล้ว" มาแล้ว เปลี่ยนได้แต่เตือนว่ากระทบ KPI ของ Vendor เดิม/ใหม่
function openVendorChange(o, reload) {
  const current = vendorLabel(o.vendor_id);
  const midFlow = ['received', 'returned'].includes(o.status);
  const opts = VENDOR_LIST.length
    ? VENDOR_LIST.map((v) => `<option value="${v.id}" ${o.vendor_id === v.id ? 'selected' : ''}>${esc(v.display_name)}</option>`).join('')
    : '<option value="">— ยังไม่มี Vendor —</option>';
  openModal(`<div class="d-no">${esc(o.rg_no)} — เปลี่ยน Vendor</div>
    <div class="vchg-card">
      <div class="vchg-row"><span class="hint">ร้านค้า</span><b>${esc(o.sold_to_name || '-')}</b></div>
      <div class="vchg-row"><span class="hint">สถานะ</span>${statusChip(o.status)}</div>
      <div class="vchg-row"><span class="hint">Vendor ปัจจุบัน</span>
        <b class="${current ? '' : 'muted'}">${esc(current || 'ยังไม่มอบหมาย')}</b></div>
    </div>
    ${midFlow ? '<div class="vchg-warn">⚠️ งานนี้เริ่มดำเนินการแล้ว — เปลี่ยน Vendor จะทำให้งานไปอยู่ในสถิติ KPI ของ Vendor ใหม่ (วันที่มอบหมายเดิมไม่เปลี่ยน)</div>' : ''}
    <label class="hint">เปลี่ยนเป็น Vendor</label>
    <select class="in" id="vc_sel">${opts}</select>
    <button class="btn primary" id="vc_save">บันทึกการเปลี่ยน</button>
    <div id="m-err" class="err"></div>`);
  $('#vc_save').onclick = async () => {
    const vendor_id = Number($('#vc_sel').value);
    if (!vendor_id) { $('#m-err').textContent = 'ยังไม่มี Vendor ให้เลือก'; return; }
    if (vendor_id === o.vendor_id) { closeModal(); return; }
    try {
      await api('/orders/' + encodeURIComponent(o.rg_no) + '/assign-vendor', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vendor_id }),
      });
      closeModal(); toast(`เปลี่ยน Vendor เป็น ${vendorLabel(vendor_id)} แล้ว`); reload();
    } catch (e) { $('#m-err').textContent = e.message; }
  };
}

// ---- Supervisor: Users ----
VIEWS.users = {
  id: 'users', label: 'จัดการผู้ใช้',
  render: () => {
    const w = el(`<div class="view"><h3>จัดการผู้ใช้</h3>
      <div class="card"><h4>สร้างผู้ใช้ใหม่</h4>
        <input id="u_user" class="in" placeholder="username"/>
        <input id="u_name" class="in" placeholder="ชื่อที่แสดง"/>
        <input id="u_pass" class="in" placeholder="รหัสผ่าน" type="text"/>
        <div class="row"><select id="u_role" class="in">
          ${['vendor', 'gr', 'supervisor'].map((r) => `<option value="${r}">${ROLE_LABEL[r]}</option>`).join('')}
        </select></div>
        <button class="btn primary" id="u_add">สร้าง</button><div id="u_err" class="err"></div></div>

      <div class="card"><h4>หมวดของ Vendor (สำหรับ dropdown หมวด+เหตุผล)</h4>
        <p class="hint">เพิ่ม/ลบ/แก้ชื่อหมวด แล้วกดบันทึก · หมวดที่ Vendor เลือกได้จะเปลี่ยนตามนี้ทันที</p>
        <div class="row" style="margin-bottom:8px">
          <input id="nc_new" class="in" placeholder="ชื่อหมวดใหม่"/>
          <button class="btn ghost" id="nc_add" style="width:auto">＋ เพิ่ม</button>
        </div>
        <div id="nc_list" class="nc-list"></div>
        <div class="row"><button class="btn primary" id="nc_save" style="width:auto">บันทึกหมวด</button>
          <div id="nc_msg" class="hint" style="align-self:center"></div></div></div>

      <div class="card"><h4>เกณฑ์ KPI (ค่าเฉลี่ยเกินกี่วัน = ขึ้นสีแดง)</h4>
        <p class="hint">ตั้งแยกได้ 3 ช่วง · มีผลกับตาราง/การ์ด KPI ทั้งระบบทันทีหลังบันทึก (ต้องรีเฟรชหน้าอื่นที่เปิดค้างไว้)</p>
        <label class="hint">1️⃣ มอบหมาย → รับสินค้า (วัน)</label>
        <input id="kl_d1" class="in" type="number" min="1" step="0.5"/>
        <label class="hint">2️⃣ รับสินค้า → นำกลับคลัง (วัน)</label>
        <input id="kl_d2" class="in" type="number" min="1" step="0.5"/>
        <label class="hint">3️⃣ รับสินค้า → ปิดงาน (วัน)</label>
        <input id="kl_d3" class="in" type="number" min="1" step="0.5"/>
        <div class="row"><button class="btn primary" id="kl_save" style="width:auto">บันทึกเกณฑ์ KPI</button>
          <div id="kl_msg" class="hint" style="align-self:center"></div></div></div>

      <div id="ulist" class="results"></div></div>`);

    // ---- เกณฑ์ KPI (kpi_limits) ----
    const fillKpi = (v) => { $('#kl_d1', w).value = v.d1; $('#kl_d2', w).value = v.d2; $('#kl_d3', w).value = v.d3; };
    fillKpi(KPI_LIMITS);
    api('/admin/kpi-limits').then(fillKpi).catch(() => {});
    $('#kl_save', w).onclick = async () => {
      const d1 = Number($('#kl_d1', w).value), d2 = Number($('#kl_d2', w).value), d3 = Number($('#kl_d3', w).value);
      for (const [n, v] of [['1️⃣', d1], ['2️⃣', d2], ['3️⃣', d3]]) {
        if (!Number.isFinite(v) || v <= 0) { $('#kl_msg', w).innerHTML = `<span class="err">ช่วง ${n} ต้องเป็นจำนวนวันมากกว่า 0</span>`; return; }
      }
      $('#kl_msg', w).textContent = 'กำลังบันทึก…';
      try {
        const r = await api('/admin/kpi-limits', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ d1, d2, d3 }),
        });
        KPI_LIMITS = { d1: r.d1, d2: r.d2, d3: r.d3 }; // อัปเดตค่าที่ใช้ render ทันที
        $('#kl_msg', w).innerHTML = '<span class="ok">บันทึกเกณฑ์แล้ว</span>';
      } catch (e) { $('#kl_msg', w).innerHTML = `<span class="err">${esc(e.message)}</span>`; }
    };

    // ---- จัดการหมวด (note_categories) ----
    let cats = [...NOTE_CATEGORIES];
    function renderCats() {
      const box = $('#nc_list', w); box.innerHTML = '';
      if (!cats.length) { box.innerHTML = '<div class="hint">ยังไม่มีหมวด — เพิ่มอย่างน้อย 1 หมวด</div>'; return; }
      cats.forEach((c, i) => {
        const row = el(`<div class="nc-item">
          <input class="in nc-in" value="${esc(c)}"/>
          <button class="btn red nc-del" style="width:auto;padding:6px 10px" title="ลบ">✕</button></div>`);
        $('.nc-in', row).oninput = (e) => { cats[i] = e.target.value; };
        $('.nc-del', row).onclick = () => { cats.splice(i, 1); renderCats(); };
        box.appendChild(row);
      });
    }
    $('#nc_add', w).onclick = () => {
      const v = $('#nc_new', w).value.trim();
      if (!v) return;
      cats.push(v); $('#nc_new', w).value = ''; renderCats();
    };
    $('#nc_new', w).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#nc_add', w).click(); } });
    $('#nc_save', w).onclick = async () => {
      const clean = [...new Set(cats.map((c) => c.trim()).filter(Boolean))];
      if (!clean.length) { $('#nc_msg', w).innerHTML = '<span class="err">ต้องมีอย่างน้อย 1 หมวด</span>'; return; }
      $('#nc_msg', w).textContent = 'กำลังบันทึก…';
      try {
        const r = await api('/admin/note-categories', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categories: clean }),
        });
        NOTE_CATEGORIES = r.categories; cats = [...r.categories]; renderCats();
        $('#nc_msg', w).innerHTML = `<span class="ok">บันทึกแล้ว ${r.categories.length} หมวด</span>`;
      } catch (e) { $('#nc_msg', w).innerHTML = `<span class="err">${esc(e.message)}</span>`; }
    };
    // โหลดค่าล่าสุดจาก server (เผื่อมีการแก้จากที่อื่น)
    api('/admin/note-categories').then((list) => { if (Array.isArray(list) && list.length) { cats = [...list]; } renderCats(); }).catch(renderCats);

    async function loadUsers() {
      const list = $('#ulist', w); list.innerHTML = 'กำลังโหลด…';
      const users = await api('/admin/users');
      list.innerHTML = '';
      users.forEach((u) => {
        const c = el(`<div class="rg"><div class="no">${esc(u.display_name)} <small>(${esc(u.username)})</small> <small>✏️ แตะเพื่อแก้ไข</small></div>
        <div class="meta"><span class="chip">${ROLE_LABEL[u.role] || u.role}</span>
        ${u.area ? `<span class="chip">พื้นที่ ${esc(u.area)}</span>` : ''}
        <span class="chip ${u.is_active ? '' : 'r'}">${u.is_active ? 'ใช้งาน' : 'ระงับ'}</span></div></div>`);
        c.onclick = () => openEditUser(u, loadUsers);
        list.appendChild(c);
      });
    }
    $('#u_add', w).onclick = async () => {
      try {
        await api('/admin/users', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: $('#u_user', w).value.trim(), display_name: $('#u_name', w).value.trim(),
            password: $('#u_pass', w).value, role: $('#u_role', w).value,
          }),
        });
        $('#u_user', w).value = $('#u_name', w).value = $('#u_pass', w).value = '';
        $('#u_err', w).textContent = ''; loadUsers();
      } catch (e) { $('#u_err', w).textContent = e.message; }
    };
    loadUsers();
    return w;
  },
};

function openEditUser(u, reload) {
  openModal(`<div class="d-no">แก้ไขผู้ใช้: ${esc(u.username)}</div>
    <label class="hint">ชื่อที่แสดง</label><input id="e_name" class="in" value="${esc(u.display_name || '')}"/>
    <label class="hint">Role</label>
    <select id="e_role" class="in">${['vendor', 'gr', 'supervisor'].map((r) =>
      `<option value="${r}" ${u.role === r ? 'selected' : ''}>${ROLE_LABEL[r]}</option>`).join('')}</select>
    <label class="hint">ตั้งรหัสผ่านใหม่ (เว้นว่าง = ไม่เปลี่ยน)</label><input id="e_pass" class="in" placeholder="รหัสผ่านใหม่"/>
    <label class="hint">สถานะบัญชี</label>
    <select id="e_active" class="in"><option value="1" ${u.is_active ? 'selected' : ''}>ใช้งาน</option>
    <option value="0" ${!u.is_active ? 'selected' : ''}>ระงับ</option></select>
    <button class="btn primary" id="e_save">บันทึก</button>
    <button class="btn red" id="e_del" style="margin-top:8px">ลบผู้ใช้</button><div id="m-err" class="err"></div>`);
  $('#e_del').onclick = async () => {
    if (!confirm(`ยืนยันลบผู้ใช้ "${u.username}"? การลบไม่สามารถย้อนกลับได้`)) return;
    try {
      await api('/admin/users/' + u.id, { method: 'DELETE' });
      closeModal(); reload();
    } catch (e) { $('#m-err').textContent = e.message; }
  };
  $('#e_save').onclick = async () => {
    try {
      const body = {
        display_name: $('#e_name').value.trim(),
        role: $('#e_role').value,
        is_active: $('#e_active').value === '1',
      };
      const pw = $('#e_pass').value;
      if (pw) body.password = pw;
      await api('/admin/users/' + u.id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      closeModal(); reload();
    } catch (e) { $('#m-err').textContent = e.message; }
  };
}

// ---- Supervisor: Vendors ----
VIEWS.vendors = {
  id: 'vendors', label: 'จัดการ Vendor',
  render: () => {
    const w = el(`<div class="view"><h3>จัดการ Vendor</h3>
      <div class="card"><input id="v_name" class="in" placeholder="ชื่อ Vendor"/>
        <input id="v_info" class="in" placeholder="ข้อมูลติดต่อ"/>
        <button class="btn primary" id="v_add">เพิ่ม Vendor</button><div id="v_err" class="err"></div></div>
      <div id="vlist" class="results"></div></div>`);
    async function loadV() {
      const list = $('#vlist', w); list.innerHTML = 'กำลังโหลด…';
      const vs = await api('/admin/vendors'); list.innerHTML = '';
      vs.forEach((v) => {
        const c = el(`<div class="rg ${v.is_active ? '' : 'off'}"><div class="no">${esc(v.vendor_name)} <small>✏️ แตะเพื่อแก้ไข</small></div>
        <div class="name">${esc(v.contact_info || '-')}</div></div>`);
        c.onclick = () => openEditVendor(v, loadV);
        list.appendChild(c);
      });
      if (!vs.length) list.innerHTML = '<div class="empty">ยังไม่มี Vendor</div>';
    }
    $('#v_add', w).onclick = async () => {
      try {
        await api('/admin/vendors', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vendor_name: $('#v_name', w).value.trim(), contact_info: $('#v_info', w).value.trim() }),
        });
        $('#v_name', w).value = $('#v_info', w).value = ''; $('#v_err', w).textContent = ''; loadV();
      } catch (e) { $('#v_err', w).textContent = e.message; }
    };
    loadV();
    return w;
  },
};

function openEditVendor(v, reload) {
  openModal(`<div class="d-no">แก้ไข Vendor</div>
    <label class="hint">ชื่อ Vendor</label><input id="ev_name" class="in" value="${esc(v.vendor_name)}"/>
    <label class="hint">ข้อมูลติดต่อ</label><input id="ev_info" class="in" value="${esc(v.contact_info || '')}"/>
    <label class="hint">สถานะ</label>
    <select id="ev_active" class="in"><option value="1" ${v.is_active ? 'selected' : ''}>ใช้งาน</option>
    <option value="0" ${!v.is_active ? 'selected' : ''}>ปิดใช้งาน</option></select>
    <button class="btn primary" id="ev_save">บันทึก</button><div id="m-err" class="err"></div>`);
  $('#ev_save').onclick = async () => {
    try {
      await api('/admin/vendors/' + v.id, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_name: $('#ev_name').value.trim(),
          contact_info: $('#ev_info').value.trim() || null,
          is_active: $('#ev_active').value === '1',
        }),
      });
      closeModal(); reload();
    } catch (e) { $('#m-err').textContent = e.message; }
  };
}

// ---- Supervisor: Area Priority Rules ----
VIEWS.arearules = {
  id: 'arearules', label: 'กติกาพื้นที่',
  render: () => {
    const w = el(`<div class="view"><h3>กติกาจัดพื้นที่อัตโนมัติ (Priority Rules)</h3>
      <p class="hint">ระบบจับคู่ order → Vendor โดยไล่จากเจาะจงไปกว้าง: <b>Ship To Code → Ship To → Sold To Code → เขต</b>
      (rule แรกที่ค่าตรงและ field เดียวกัน เรียงตาม Priority น้อย→มาก)</p>
      <div class="card"><h4>เพิ่ม Rule</h4>
        <div class="row"><input id="r_pri" class="in" type="number" value="100" title="Priority"/>
        <select id="r_field" class="in"></select></div>
        <input id="r_val" class="in" placeholder="ค่าที่ต้องตรง เช่น 011606 / 153"/>
        <select id="r_vendor" class="in"><option value="">— เลือก Vendor —</option></select>
        <button class="btn primary" id="r_add">เพิ่ม Rule</button><div id="r_err" class="err"></div></div>
      <button class="btn red" id="r_apply">⟳ Re-assign งานรอจัดพื้นที่ตาม Rules</button>
      <div id="r_apply_out" class="hint"></div>
      <div id="rlist" class="results" style="margin-top:12px"></div></div>`);

    let FIELDS = [], VENDORS = [];
    api('/admin/area-rules/fields').then((fs) => {
      FIELDS = fs;
      $('#r_field', w).innerHTML = fs.map((f) => `<option value="${f.key}">${esc(f.label)}</option>`).join('');
    });
    api('/lookup/vendors').then((vs) => {
      VENDORS = vs;
      $('#r_vendor', w).innerHTML = '<option value="">— เลือก Vendor —</option>'
        + vs.map((v) => `<option value="${v.id}">${esc(v.display_name)}</option>`).join('');
    });
    const fieldLabel = (k) => (FIELDS.find((f) => f.key === k)?.label) || k;
    const vendorName = (id) => (VENDORS.find((v) => v.id === id)?.display_name) || `#${id}`;

    async function loadRules() {
      const list = $('#rlist', w); list.innerHTML = 'กำลังโหลด…';
      const rules = await api('/admin/area-rules');
      list.innerHTML = rules.length ? '' : '<div class="empty">ยังไม่มี Rule</div>';
      rules.forEach((r) => {
        const c = el(`<div class="rg ${r.enabled ? '' : 'off'}">
          <div class="no">#${r.priority} · ${esc(fieldLabel(r.rule_field))} = "${esc(r.match_value)}" → Vendor: ${esc(vendorName(r.vendor_id))}${r.area ? ` · พื้นที่ ${esc(r.area)}` : ''}</div>
          <div class="meta">
            <button class="chip btn-chip" data-act="toggle">${r.enabled ? '✅ เปิดใช้' : '⬜ ปิดอยู่'}</button>
            <button class="chip btn-chip" data-act="edit">✏️ แก้ไข</button>
            <button class="chip btn-chip r" data-act="del">🗑 ลบ</button>
          </div></div>`);
        c.querySelector('[data-act=edit]').onclick = () => {
          openModal(`<div class="d-no">แก้ไข Rule #${r.id}</div>
            <label class="hint">Priority (น้อย = เช็คก่อน)</label><input id="er_pri" class="in" type="number" value="${r.priority}"/>
            <label class="hint">เงื่อนไข</label>
            <select id="er_field" class="in">${FIELDS.map((f) => `<option value="${f.key}" ${r.rule_field === f.key ? 'selected' : ''}>${esc(f.label)}</option>`).join('')}</select>
            <label class="hint">ค่าที่ต้องตรง</label><input id="er_val" class="in" value="${esc(r.match_value)}"/>
            <label class="hint">Vendor</label>
            <select id="er_vendor" class="in"><option value="">— เลือก Vendor —</option>
            ${VENDORS.map((v) => `<option value="${v.id}" ${r.vendor_id === v.id ? 'selected' : ''}>${esc(v.display_name)}</option>`).join('')}</select>
            <button class="btn primary" id="er_save">บันทึก</button><div id="m-err" class="err"></div>`);
          $('#er_save').onclick = async () => {
            try {
              await api('/admin/area-rules/' + r.id, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  priority: Number($('#er_pri').value) || 100,
                  rule_field: $('#er_field').value,
                  match_value: $('#er_val').value.trim(),
                  vendor_id: Number($('#er_vendor').value) || null,
                }),
              });
              closeModal(); loadRules();
            } catch (e) { $('#m-err').textContent = e.message; }
          };
        };
        c.querySelector('[data-act=toggle]').onclick = async () => {
          await api('/admin/area-rules/' + r.id, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: !r.enabled }),
          });
          loadRules();
        };
        c.querySelector('[data-act=del]').onclick = async () => {
          await api('/admin/area-rules/' + r.id, { method: 'DELETE' });
          loadRules();
        };
        list.appendChild(c);
      });
    }
    $('#r_add', w).onclick = async () => {
      try {
        await api('/admin/area-rules', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            priority: Number($('#r_pri', w).value) || 100,
            rule_field: $('#r_field', w).value,
            match_value: $('#r_val', w).value.trim(),
            vendor_id: Number($('#r_vendor', w).value) || null,
          }),
        });
        $('#r_val', w).value = ''; $('#r_err', w).textContent = '';
        loadRules();
      } catch (e) { $('#r_err', w).textContent = e.message; }
    };
    $('#r_apply', w).onclick = async () => {
      const out = $('#r_apply_out', w); out.textContent = 'กำลังคำนวณ…';
      try {
        const r = await api('/admin/area-rules/apply', { method: 'POST' });
        out.textContent = `Re-assign สำเร็จ ${r.assigned} รายการ · ยังไม่ตรงกติกา ${r.waiting} รายการ`;
      } catch (e) { out.textContent = 'ผิดพลาด: ' + e.message; }
    };
    loadRules();
    return w;
  },
};

// ---- Supervisor: ออเดอร์รอจัดพื้นที่ (ยังไม่มี Vendor) ----
VIEWS.unassigned = {
  id: 'unassigned', label: 'รอจัดพื้นที่',
  render: () => {
    const w = el(`<div><div class="view wide"><h3>ออเดอร์รอจัดพื้นที่</h3>
      <p class="hint">ออเดอร์ที่ไม่ตรงกติกาใดเลย (ร้านใหม่) — เพิ่มกติกาแล้วกด Re-assign หรือเลือกหลายใบแล้ว assign มือด้านล่าง</p>
      <div class="card">
        <button class="btn primary" id="ureassign" style="width:auto">⟳ Re-assign ตามกติกาปัจจุบัน</button>
        <div id="ureout" class="hint"></div>
        <div class="jfilters" style="margin-top:10px">
          <label class="jf jf-search"><span>ค้นหา (เว้นวรรค=ต้องมีทุกคำ · ,=อย่างใดอย่างหนึ่ง)</span>
            <input id="usearch" class="in" placeholder="เช่น บางรัก ซีเจ, 010011 — RG/Sold To Code/ร้านค้า/อำเภอ/จังหวัด"/></label>
          <label class="jf"><span>จัดกลุ่มตาม</span>
            <select id="ugrpby" class="in">${GROUP_FIELDS.map((g) => `<option value="${g.key}">${g.label}</option>`).join('')}</select></label>
          <label class="jf jf-chk"><span>ตัวกรอง</span>
            <label class="chk"><input type="checkbox" id="uhide" checked/>
              <span>ซ่อน Sold To Code = ${esc(HIDE_SOLD_TO_CODE)}</span></label></label>
        </div>
        <div id="uhidden" class="hint"></div>
      </div>
      <div id="ulist2"></div>
      <p class="hint">💡 ตั้ง <b>กติกาจัดพื้นที่</b> เพื่อให้ระบบ assign ให้อัตโนมัติตอน Upload ครั้งถัดไป</p></div>
    <div class="assign-bar hidden" id="ubar">
      <span id="ucount" class="acount">0</span>
      <select id="ubar-vendor" class="in"></select>
      <button class="btn red" id="ubar-go">มอบหมาย Vendor ที่เลือก</button>
    </div></div>`);

    let all = [], selected = new Set();

    api('/lookup/vendors').then((vs) => {
      $('#ubar-vendor', w).innerHTML = vs.length
        ? vs.map((v) => `<option value="${v.id}">${esc(v.display_name)}</option>`).join('')
        : '<option value="">— ยังไม่มี Vendor —</option>';
    });

    $('#ureassign', w).onclick = async () => {
      const out = $('#ureout', w); out.textContent = 'กำลังจับคู่…';
      try {
        const r = await api('/orders/auto-assign', { method: 'POST' });
        out.textContent = `Re-assign สำเร็จ ${r.assigned} รายการ · ยังไม่ตรงกติกา ${r.waiting} รายการ`;
        load();
      } catch (e) { out.textContent = 'ผิดพลาด: ' + e.message; }
    };

    async function load() {
      const box = $('#ulist2', w); box.innerHTML = '<div class="empty">กำลังโหลด…</div>';
      // ดึงทั้งหมด (หลายหน้า) มา group ฝั่ง client แบบเดียวกับหน้า มอบหมาย Vendor
      all = []; let page = 1, total = Infinity;
      const q = $('#usearch', w).value.trim();
      while (all.length < total && page <= 20) {
        const r = await api('/orders/unassigned?' + new URLSearchParams({ q, page, pageSize: 100 }));
        all.push(...r.data); total = r.total; if (!r.data.length) break; page++;
      }
      selected.clear(); updateBar();
      render();
    }

    function render() {
      const box = $('#ulist2', w); box.innerHTML = '';
      if (!all.length) { box.innerHTML = '<div class="empty">ไม่มีออเดอร์รอจัดพื้นที่ 🎉</div>'; return; }
      // ตัวกรองเริ่มต้น: ซ่อน Sold To Code ที่ไม่ต้องจัดพื้นที่ (ติ๊กออกเพื่อดูทั้งหมด)
      const hide = $('#uhide', w).checked;
      const shown = hide ? all.filter((o) => String(o.sold_to_code || '') !== HIDE_SOLD_TO_CODE) : all;
      const nHidden = all.length - shown.length;
      // ใบที่ถูกซ่อนต้องไม่ค้างอยู่ในรายการที่เลือก — กันเผลอ assign ใบที่มองไม่เห็น
      if (nHidden) {
        const visible = new Set(shown.map((o) => o.rg_no));
        [...selected].forEach((rg) => { if (!visible.has(rg)) selected.delete(rg); });
        updateBar();
      }
      $('#uhidden', w).innerHTML = nHidden
        ? `ซ่อนอยู่ <b>${nHidden}</b> ออเดอร์ (Sold To Code = ${esc(HIDE_SOLD_TO_CODE)}) — ติ๊ก "ซ่อน…" ออกเพื่อดู`
        : '';
      if (!shown.length) { box.innerHTML = `<div class="empty">ไม่มีออเดอร์รอจัดพื้นที่ (ซ่อนอยู่ ${nHidden} ออเดอร์) 🎉</div>`; return; }
      const gk = $('#ugrpby', w).value;
      const groups = new Map();
      for (const o of shown) {
        const key = gk ? (o[gk] || '(ไม่ระบุ)') : '__all__';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(o);
      }
      for (const [key, items] of groups) {
        const g = el(`<div class="agroup card">
          ${gk ? `<div class="agroup-head"><label class="chk"><input type="checkbox" class="gsel"/> <b>${esc(key)}</b> <span class="hint">(${items.length})</span></label></div>` : ''}
          <div class="agroup-body"></div></div>`);
        const body = $('.agroup-body', g);
        // ตารางรายละเอียดครบแบบหน้า "ออเดอร์ทั้งหมด" + คอลัมน์เลือก
        const tblWrap = el(`<div class="table-scroll"><table class="otable">
          <thead><tr>
            <th><input type="checkbox" class="selall" title="เลือกทั้งหมด"/></th>
            <th>เลขที่ RG</th><th>สถานะ</th><th>เขต</th><th class="code">Sold To Code</th><th class="code">Ship To</th><th>Sold To</th>
            <th class="num">กล่อง</th><th class="num">ชิ้น</th><th>WH</th><th>อำเภอ</th><th>จังหวัด</th><th>Region</th>
            <th class="dt">วันที่พิมพ์</th><th class="dt">วันที่ Upload</th>
          </tr></thead><tbody></tbody></table></div>`);
        const tb = $('tbody', tblWrap);
        items.forEach((o) => {
          const tr = el(`<tr class="${selected.has(o.rg_no) ? 'on' : ''}">
            <td><input type="checkbox" class="osel" ${selected.has(o.rg_no) ? 'checked' : ''}/></td>
            <td class="no">${esc(o.rg_no)}</td>
            <td>${statusChip(o.status)}</td>
            <td>${esc(o.zone || '-')}</td>
            <td class="code">${esc(o.sold_to_code || '-')}</td>
            <td class="code">${esc(o.sold_to || '-')}</td>
            <td class="l soldto">${esc(o.sold_to_name || '-')}</td>
            <td class="num">${o.qty_boxes ?? 0}</td>
            <td class="num">${o.qty_pieces ?? 0}</td>
            <td>${esc(o.wh_code || '-')}</td>
            <td>${esc(o.district || '-')}</td>
            <td>${esc(o.province || '-')}</td>
            <td>${esc(o.region || '-')}</td>
            <td class="dt">${o.rg_date ? fmtDate(o.rg_date) : '-'}</td>
            <td class="dt">${o.uploaded_at ? fmtDateTime(o.uploaded_at) : '-'}</td></tr>`);
          const cb = $('.osel', tr);
          const setRow = () => { cb.checked ? selected.add(o.rg_no) : selected.delete(o.rg_no); tr.classList.toggle('on', cb.checked); syncGroupChk(g, items); syncSelAll(); updateBar(); };
          cb.onchange = setRow;
          tr.onclick = (e) => { if (e.target !== cb) { cb.checked = !cb.checked; setRow(); } };
          tb.appendChild(tr);
        });
        const selall = $('.selall', tblWrap);
        const syncSelAll = () => {
          const on = items.filter((o) => selected.has(o.rg_no)).length;
          selall.checked = on === items.length && on > 0;
          selall.indeterminate = on > 0 && on < items.length;
        };
        syncSelAll();
        selall.onchange = () => {
          items.forEach((o) => selall.checked ? selected.add(o.rg_no) : selected.delete(o.rg_no));
          render(); updateBar();
        };
        const gsel = $('.gsel', g);
        if (gsel) {
          syncGroupChk(g, items);
          gsel.onchange = () => {
            items.forEach((o) => gsel.checked ? selected.add(o.rg_no) : selected.delete(o.rg_no));
            render(); updateBar();
          };
        }
        body.appendChild(tblWrap);
        box.appendChild(g);
      }
    }

    function syncGroupChk(g, items) {
      const gsel = $('.gsel', g); if (!gsel) return;
      const on = items.filter((o) => selected.has(o.rg_no)).length;
      gsel.checked = on === items.length && on > 0;
      gsel.indeterminate = on > 0 && on < items.length;
    }

    function updateBar() { $('#ucount', w).textContent = selected.size; $('#ubar', w).classList.toggle('hidden', selected.size === 0); }
    $('#ugrpby', w).onchange = render;
    $('#uhide', w).onchange = render;   // กรองฝั่ง client — ไม่ต้องโหลดใหม่
    let t; $('#usearch', w).oninput = () => { clearTimeout(t); t = setTimeout(load, 400); };
    $('#ubar-go', w).onclick = async () => {
      const vendor_id = Number($('#ubar-vendor', w).value);
      if (!vendor_id) { toast('ยังไม่มี Vendor ให้เลือก'); return; }
      try {
        const r = await api('/orders/bulk-assign-vendor', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rg_nos: [...selected], vendor_id }),
        });
        toast(`มอบหมายสำเร็จ ${r.assigned} รายการ`);
        selected.clear(); updateBar(); load();
      } catch (e) { toast('ผิดพลาด: ' + e.message); }
    };
    load();
    return w;
  },
};

// ---- KPI Table (Supervisor เห็นทุก Vendor / Vendor เห็นของตัวเอง) ----
// เกณฑ์ KPI 3 ช่วง (วัน) — โหลดจาก DB ตอน login (Supervisor ปรับได้) · fallback = 3 ทุกช่วง
let KPI_LIMITS = { d1: 3, d2: 3, d3: 3 };
const kpiLimit = (stage) => KPI_LIMITS[stage] ?? 3;
// ข้อความอธิบายเกณฑ์: ถ้าทุกช่วงเท่ากันแสดงค่าเดียว ไม่งั้นแสดงแยก 3 ช่วง
const kpiLimitText = () => {
  const { d1, d2, d3 } = KPI_LIMITS;
  return (d1 === d2 && d2 === d3) ? `${d1} วัน` : `${d1}/${d2}/${d3} วัน (ตามช่วง)`;
};
const kpiCell = (v, stage) => v == null ? '<td class="num muted">-</td>'
  : `<td class="num ${v > kpiLimit(stage) ? 'kpi-bad' : ''}">${v}</td>`;

VIEWS.kpi = {
  id: 'kpi', label: 'KPI',
  render: () => {
    const w = el(`<div class="view wide"><h3>KPI ระยะเวลาการทำงาน (หน่วย: วัน)</h3>
      <p class="hint">นับจำนวนวันที่ใช้ในแต่ละช่วง — ยิ่งน้อยยิ่งดี · ค่าเฉลี่ยเกินเกณฑ์ (${kpiLimitText()}) จะขึ้น<span class="kpi-bad">สีแดง</span><br/>
      1️⃣ ตั้งแต่มอบหมาย จนรับสินค้า · 2️⃣ ตั้งแต่รับสินค้า จนนำกลับคลัง · 3️⃣ ตั้งแต่รับสินค้า จนปิดงาน</p>
      <div class="card filter-row">
        <input id="kfrom" type="date" class="in" title="ตั้งแต่วันที่มอบหมาย"/>
        <input id="kto" type="date" class="in" title="ถึงวันที่มอบหมาย"/>
        <button class="btn primary" id="kgo">ค้นหา</button>
        <button class="btn ghost" id="kexp-sum">⬇️ Export สรุป</button>
        <button class="btn ghost" id="kexp-ord">⬇️ Export รายออเดอร์</button>
      </div>
      <h4>สรุปภาพรวม (แยกตาม Vendor) — แตะแถวเพื่อดูรายออเดอร์</h4>
      <div id="ksum"><div class="empty">กำลังโหลด…</div></div>
      <h4 id="kord-title" class="hidden">รายออเดอร์</h4>
      <div id="kord"></div></div>`);

    const range = () => {
      const p = {};
      if ($('#kfrom', w).value) p.from = $('#kfrom', w).value;
      if ($('#kto', w).value) p.to = $('#kto', w).value;
      return p;
    };

    async function loadSummary() {
      const box = $('#ksum', w); box.innerHTML = '<div class="empty">กำลังโหลด…</div>';
      $('#kord', w).innerHTML = ''; $('#kord-title', w).classList.add('hidden');
      try {
        const { vendors, total } = await api('/kpi/summary?' + new URLSearchParams(range()));
        if (!vendors.length) { box.innerHTML = '<div class="empty">ยังไม่มีงานที่ถูกมอบหมายในช่วงนี้</div>'; return; }
        const tbl = el(`<div class="table-scroll"><table class="otable">
          <thead><tr><th>Vendor</th><th class="num">จำนวนงาน</th><th class="num">ปิดงานแล้ว</th>
          <th class="num">มอบหมาย→รับ (เฉลี่ย)</th><th class="num">รับ→กลับคลัง (เฉลี่ย)</th><th class="num">รับ→ปิดงาน (เฉลี่ย)</th>
          </tr></thead><tbody></tbody></table></div>`);
        const tb = $('tbody', tbl);
        for (const v of vendors) {
          const tr = el(`<tr>
            <td class="l">${esc(v.vendor_name)}</td>
            <td class="num">${v.orders}</td><td class="num">${v.completed}</td>
            ${kpiCell(v.avg_assign_to_receive, 'd1')}${kpiCell(v.avg_receive_to_return, 'd2')}${kpiCell(v.avg_receive_to_complete, 'd3')}</tr>`);
          tr.onclick = () => loadOrders(v.vendor_id, v.vendor_name);
          tb.appendChild(tr);
        }
        if (total) tb.appendChild(el(`<tr class="kpi-total">
          <td class="l"><b>${esc(total.vendor_name)}</b></td>
          <td class="num"><b>${total.orders}</b></td><td class="num"><b>${total.completed}</b></td>
          ${kpiCell(total.avg_assign_to_receive, 'd1')}${kpiCell(total.avg_receive_to_return, 'd2')}${kpiCell(total.avg_receive_to_complete, 'd3')}</tr>`));
        box.innerHTML = ''; box.appendChild(tbl);
      } catch (e) { box.innerHTML = `<div class="empty err">${esc(e.message)}</div>`; }
    }

    async function loadOrders(vendor_id, vendor_name) {
      const box = $('#kord', w); box.innerHTML = '<div class="empty">กำลังโหลด…</div>';
      const title = $('#kord-title', w); title.classList.remove('hidden');
      title.textContent = `รายออเดอร์ — ${vendor_name || 'ทั้งหมด'}`;
      try {
        const p = { ...range() }; if (vendor_id) p.vendor_id = vendor_id;
        const rows = await api('/kpi/orders?' + new URLSearchParams(p));
        if (!rows.length) { box.innerHTML = '<div class="empty">ไม่มีรายการ</div>'; return; }
        const tbl = el(`<div class="table-scroll"><table class="otable">
          <thead><tr><th>เลขที่ RG</th><th>Vendor</th><th>ร้านค้า</th><th>สถานะ</th>
          <th>มอบหมาย</th><th>รับสินค้า</th><th>กลับคลัง</th><th>ปิดงาน</th>
          <th class="num" title="ตั้งแต่มอบหมาย จนรับสินค้า">1️⃣ มอบหมาย→รับ</th>
          <th class="num" title="ตั้งแต่รับสินค้า จนนำกลับคลัง">2️⃣ รับ→กลับคลัง</th>
          <th class="num" title="ตั้งแต่รับสินค้า จนปิดงาน">3️⃣ รับ→ปิดงาน</th>
          </tr></thead><tbody></tbody></table></div>`);
        const tb = $('tbody', tbl);
        for (const r of rows) {
          tb.appendChild(el(`<tr>
            <td class="no">${esc(r.rg_no)}</td>
            <td>${esc(r.vendor_name)}</td>
            <td class="l soldto">${esc(r.sold_to_name || '-')}</td>
            <td>${statusChip(r.status)}</td>
            <td>${r.assigned_at ? fmtDate(r.assigned_at) : '-'}</td>
            <td>${r.received_date ? fmtDate(r.received_date) : '-'}</td>
            <td>${r.returned_date ? fmtDate(r.returned_date) : '-'}</td>
            <td>${r.completed_date ? fmtDate(r.completed_date) : '-'}</td>
            ${kpiCell(r.d1, 'd1')}${kpiCell(r.d2, 'd2')}${kpiCell(r.d3, 'd3')}</tr>`));
        }
        box.innerHTML = ''; box.appendChild(tbl);
      } catch (e) { box.innerHTML = `<div class="empty err">${esc(e.message)}</div>`; }
    }

    $('#kgo', w).onclick = loadSummary;
    $('#kexp-sum', w).onclick = () =>
      window.open(withToken('/api/kpi/export?' + new URLSearchParams({ ...range(), type: 'summary' })), '_blank');
    $('#kexp-ord', w).onclick = () =>
      window.open(withToken('/api/kpi/export?' + new URLSearchParams({ ...range(), type: 'orders' })), '_blank');

    loadSummary();
    if (me.role === 'vendor') loadOrders(null, me.display_name);
    return w;
  },
};

// ---- Dashboard (all roles) ----
VIEWS.dashboard = {
  id: 'dashboard', label: 'Dashboard',
  render: () => {
    if (me.role === 'vendor') return vendorDashboard();
    return supervisorDashboard(); // supervisor / admin / gr — ศูนย์ควบคุมเต็มจอ
  },
};

// ---- Dashboard สำหรับ Supervisor/Admin/GR: ศูนย์ควบคุมเต็มจอ ----
function supervisorDashboard() {
  const today = new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  // ผู้ที่มีแท็บ "รอจัดพื้นที่" เท่านั้น (supervisor/admin) จึงเห็นปุ่มลัดจัดการ — GR ไม่มี
  const assignTab = menuFor(me.role).find((v) => v.id === 'unassigned');
  const canAssign = !!assignTab;
  const w = el(`<div class="view wide sboard">
    <header class="shero">
      <div class="shero-l">
        <div class="shero-title">ศูนย์ควบคุมออเดอร์</div>
        <div class="shero-sub">${esc(today)}</div>
      </div>
      <div class="shero-r">
        ${canAssign ? '<button class="btn ghost sbtn" id="s-goassign">จัดการออเดอร์รอจัดพื้นที่ →</button>' : ''}
        <button class="btn ghost sbtn" id="s-exp">⬇️ Export Excel</button>
      </div>
    </header>

    <div id="s-alert"></div>

    <section class="sgrid-stats" id="s-stats">${sSkel(6, 'sstat-skel')}</section>

    <div class="sboard-cols">
      <section class="scard sflow">
        <div class="scard-head"><h4>ความคืบหน้าตามขั้นตอน</h4><span class="scard-note" id="s-flow-note"></span></div>
        <div id="s-flow" class="sflow-body">${sSkel(5, 'sflow-skel')}</div>
      </section>

      <section class="scard sperf">
        <div class="scard-head"><h4>ผลงาน Vendor</h4><span class="scard-note">เวลาเฉลี่ย (วัน) · เกินเกณฑ์ (${kpiLimitText()}) ขึ้นสีแดง</span></div>
        <div class="stable-wrap"><table class="stable" id="s-vtable">
          <thead><tr><th>Vendor</th><th class="num">งาน</th><th class="num">ปิดแล้ว</th><th class="num">คืบหน้า</th>
            <th class="num" title="มอบหมาย → รับสินค้า">มอบ→รับ</th>
            <th class="num" title="รับสินค้า → นำกลับคลัง">รับ→คลัง</th>
            <th class="num" title="รับสินค้า → ปิดงาน">รับ→ปิด</th></tr></thead>
          <tbody><tr><td colspan="7" class="sempty">กำลังโหลด…</td></tr></tbody>
        </table></div>
      </section>
    </div>
  </div>`);

  if (canAssign) $('#s-goassign', w).onclick = () => jumpTo(assignTab);
  $('#s-exp', w).onclick = () => window.open(withToken('/api/dashboard/export'), '_blank');

  Promise.all([
    api('/dashboard/summary'),
    api('/kpi/summary').catch(() => ({ vendors: [], total: null })),
  ]).then(([s, k]) => {
    const c = s.counts || {};
    const total = s.total || 0;
    const done = c.completed ?? 0;
    const inYard = c.returned ?? 0;   // อยู่ที่คลัง รอ GR ปิด
    const active = (c.assigned_vendor ?? 0) + (c.received ?? 0);
    const pct = total ? Math.round((done / total) * 100) : 0;

    // แถบเตือนงานค้างจัดพื้นที่ (เฉพาะ role ที่จัดการได้)
    if (s.unassigned > 0 && canAssign) {
      $('#s-alert', w).innerHTML = `<div class="salert">
        <span class="salert-ic">!</span>
        <span>มี <b>${s.unassigned}</b> ออเดอร์รอจัดพื้นที่ (ร้านใหม่/ไม่ตรงกติกา) — เพิ่มกติกาแล้ว Re-assign หรือ assign มือ</span>
        <button class="salert-go" id="s-alert-go">ไปจัดการ</button></div>`;
      $('#s-alert-go', w).onclick = () => jumpTo(assignTab);
    }

    // การ์ดสรุปหลัก — เรียงตามความสำคัญของ Supervisor
    const stat = (n, label, tone, hint) => `<div class="sstat sstat-${tone}">
      <div class="sstat-n">${n}</div><div class="sstat-l">${label}</div>
      ${hint ? `<div class="sstat-h">${hint}</div>` : ''}</div>`;
    $('#s-stats', w).innerHTML =
      stat(s.unassigned ?? 0, 'รอจัดพื้นที่', s.unassigned > 0 ? 'alert' : 'ok', 'ต้องจัดการ')
      + stat(active, 'กำลังดำเนินการ', 'blue', 'อยู่กับ Vendor')
      + stat(inYard, 'รอปิดงาน', inYard > 0 ? 'warn' : 'ok', 'อยู่ที่คลัง')
      + stat(done, 'ปิดงานแล้ว', 'ok', 'เสร็จสมบูรณ์')
      + stat(total, 'ออเดอร์ทั้งหมด', 'neutral', '')
      + stat(pct + '%', 'อัตราปิดงาน', pct >= 70 ? 'ok' : 'neutral', `${done}/${total}`);

    // funnel ความคืบหน้าตามขั้นตอน (แถบแนวนอนสัดส่วน)
    const flow = [
      ['pending', 'รอจัดพื้นที่', 'alert'],
      ['assigned_vendor', 'มอบหมายแล้ว', 'blue'],
      ['received', 'รับสินค้าแล้ว', 'blue'],
      ['returned', 'นำกลับคลังแล้ว', 'warn'],
      ['gr_received', 'รับสินค้าเข้าระบบ', 'warn'],
      ['completed', 'ปิดงาน', 'ok'],
    ];
    const max = Math.max(1, ...flow.map(([key]) => c[key] ?? 0));
    $('#s-flow-note', w).textContent = `รวม ${total} ออเดอร์`;
    $('#s-flow', w).innerHTML = flow.map(([key, label, tone]) => {
      const n = c[key] ?? 0;
      const width = Math.round((n / max) * 100);
      return `<div class="sflow-row">
        <div class="sflow-label">${label}</div>
        <div class="sflow-bar"><div class="sflow-fill sflow-${tone}" style="width:${width}%"></div></div>
        <div class="sflow-n">${n}</div></div>`;
    }).join('');

    // ตารางผลงาน Vendor
    const vt = $('#s-vtable tbody', w);
    const vendors = k.vendors || [];
    if (!vendors.length) { vt.innerHTML = '<tr><td colspan="7" class="sempty">ยังไม่มีข้อมูลงานที่มอบหมาย</td></tr>'; return; }
    const kc = (v, stage) => v == null ? '<td class="num sdash">—</td>' : `<td class="num ${v > kpiLimit(stage) ? 'kpi-bad' : ''}">${v}</td>`;
    vt.innerHTML = vendors.map((v) => {
      const vp = v.orders ? Math.round((v.completed / v.orders) * 100) : 0;
      return `<tr>
        <td class="l"><b>${esc(v.vendor_name)}</b></td>
        <td class="num">${v.orders}</td><td class="num">${v.completed}</td>
        <td class="num"><span class="sprog"><span class="sprog-fill" style="width:${vp}%"></span></span><small>${vp}%</small></td>
        ${kc(v.avg_assign_to_receive, 'd1')}${kc(v.avg_receive_to_return, 'd2')}${kc(v.avg_receive_to_complete, 'd3')}</tr>`;
    }).join('');
    if (k.total) {
      const t = k.total;
      vt.insertAdjacentHTML('beforeend', `<tr class="stotal">
        <td class="l"><b>รวมทั้งระบบ</b></td>
        <td class="num"><b>${t.orders}</b></td><td class="num"><b>${t.completed}</b></td><td class="num">—</td>
        ${kc(t.avg_assign_to_receive, 'd1')}${kc(t.avg_receive_to_return, 'd2')}${kc(t.avg_receive_to_complete, 'd3')}</tr>`);
    }
  }).catch((e) => { $('#s-stats', w).innerHTML = `<div class="empty err">${esc(e.message)}</div>`; });

  return w;
}
function sSkel(n, cls) { return Array.from({ length: n }, () => `<div class="${cls}"></div>`).join(''); }

// ---- Dashboard สำหรับ supervisor/admin/gr (นับตามสถานะ) ----
function genericDashboard() {
  const canExport = ['supervisor', 'admin'].includes(me.role);
  const w = el(`<div class="view"><h3>ภาพรวมออเดอร์</h3>
    <div id="cards" class="stat-grid">กำลังโหลด…</div>
    ${canExport ? '<button class="btn ghost" id="exp">⬇️ Export Excel</button>' : ''}</div>`);
  api('/dashboard/summary').then((s) => {
    let alert = '';
    if (['supervisor', 'admin'].includes(me.role) && s.unassigned > 0) {
      alert = `<div class="alert-banner">🔔 มี <b>${s.unassigned}</b> ออเดอร์รอจัดพื้นที่ (ร้านใหม่/ไม่ตรงกติกา) — เพิ่มกติกาแล้ว Re-assign หรือ assign มือที่แท็บ "รอจัดพื้นที่"</div>`;
    }
    $('#cards', w).insertAdjacentHTML('beforebegin', alert);
    $('#cards', w).innerHTML = Object.keys(STATUS).map((k) =>
      `<div class="stat"><div class="stat-n">${s.counts[k] ?? 0}</div><div class="stat-l">${STATUS[k]}</div></div>`).join('')
      + `<div class="stat total"><div class="stat-n">${s.total}</div><div class="stat-l">รวมทั้งหมด</div></div>`;
  }).catch((e) => { $('#cards', w).innerHTML = `<div class="err">${esc(e.message)}</div>`; });
  if (canExport) $('#exp', w).onclick = () => window.open(withToken('/api/dashboard/export'), '_blank');
  return w;
}

// ---- Dashboard สำหรับ Vendor: เน้นงานที่ต้องลงมือ + ความคืบหน้า + KPI ของตัวเอง ----
function vendorDashboard() {
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'สวัสดีตอนเช้า' : hour < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
  const today = new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const w = el(`<div class="view vboard">
    <header class="vhero">
      <div>
        <div class="vhero-hi">${greet}, ${esc(me.display_name || me.username)}</div>
        <div class="vhero-sub">ภาพรวมงานของคุณ · ${esc(today)}</div>
      </div>
      <div class="vhero-badge" id="vh-open">—</div>
    </header>

    <section class="vsection" aria-label="สิ่งที่ต้องลงมือ">
      <div class="vsec-head"><h4>สิ่งที่ต้องลงมือ</h4><span class="vsec-note">อัปเดตวันที่ในแท็บ “งานของฉัน”</span></div>
      <div id="v-actions" class="vgrid">${vSkeleton(2)}</div>
    </section>

    <section class="vsection" aria-label="ความคืบหน้าการปิดงาน">
      <div class="vsec-head"><h4>ความคืบหน้าการปิดงาน</h4><span class="vsec-note" id="v-prog-note"></span></div>
      <div class="vprogress-card"><div class="vprogress"><div class="vprogress-fill" id="v-prog-fill"></div></div>
        <div class="vprogress-legend" id="v-prog-legend"></div></div>
    </section>

    <section class="vsection" aria-label="เวลาเฉลี่ยในการทำงาน">
      <div class="vsec-head"><h4>เวลาเฉลี่ยในการทำงานของคุณ</h4><span class="vsec-note">หน่วย: วัน · ยิ่งน้อยยิ่งดี (เกินเกณฑ์ ${kpiLimitText()} ขึ้นสีแดง)</span></div>
      <div id="v-kpi" class="vgrid vgrid-3">${vSkeleton(3)}</div>
    </section>
  </div>`);

  // การ์ด "สิ่งที่ต้องลงมือ" — ตัวเลขที่ vendor ต้องจัดการจริง
  const actionCard = (n, label, sub, tone, icon) => `
    <div class="vcard vcard-${tone} ${n > 0 && tone !== 'ok' ? 'is-live' : ''}">
      <div class="vcard-ic">${icon}</div>
      <div class="vcard-body"><div class="vcard-n">${n}</div><div class="vcard-l">${label}</div>
        <div class="vcard-s">${sub}</div></div></div>`;

  Promise.all([
    api('/dashboard/summary'),
    api('/kpi/summary').catch(() => ({ total: null })),
  ]).then(([s, k]) => {
    const c = s.counts || {};
    const assigned = c.assigned_vendor ?? 0;   // ยังไม่รับสินค้า
    const received = c.received ?? 0;           // รับแล้ว รอนำกลับคลัง
    const returned = c.returned ?? 0;           // นำกลับคลังแล้ว รอ GR ปิดงาน
    const completed = c.completed ?? 0;
    const total = s.total ?? 0;
    const openWork = assigned + received;       // งานค้างที่อยู่ในมือ vendor

    $('#vh-open', w).textContent = openWork > 0 ? `${openWork} งานค้าง` : 'ไม่มีงานค้าง 🎉';
    $('#vh-open', w).classList.toggle('is-clear', openWork === 0);

    $('#v-actions', w).innerHTML =
      actionCard(assigned, 'รอรับสินค้า', 'ยังไม่ได้กรอกวันที่รับ', assigned > 0 ? 'red' : 'ok', '📥')
      + actionCard(received, 'รอนำกลับคลัง', 'รับแล้ว รอนำสินค้ากลับ', received > 0 ? 'amber' : 'ok', '🔄');

    // progress: ปิดงานแล้ว / งานทั้งหมด
    const pct = total ? Math.round((completed / total) * 100) : 0;
    $('#v-prog-fill', w).style.width = pct + '%';
    $('#v-prog-fill', w).textContent = pct >= 12 ? pct + '%' : '';
    $('#v-prog-note', w).textContent = `${completed} / ${total} ออเดอร์`;
    $('#v-prog-legend', w).innerHTML =
      `<span><i class="dot dot-done"></i>ปิดงานแล้ว ${completed}</span>`
      + `<span><i class="dot dot-wait"></i>รอปิดงาน (ที่คลัง) ${returned}</span>`
      + `<span><i class="dot dot-open"></i>อยู่ระหว่างดำเนินการ ${openWork}</span>`;

    // KPI เวลาเฉลี่ยของ vendor เอง (total = aggregate ของตัวเอง)
    const t = k.total || {};
    const kcard = (v, stage, label, hint) => {
      const bad = v != null && v > kpiLimit(stage);
      const val = v == null ? '—' : v;
      return `<div class="vkpi ${bad ? 'is-bad' : ''}">
        <div class="vkpi-n">${val}<small>วัน</small></div>
        <div class="vkpi-l">${label}</div><div class="vkpi-h">${hint}</div></div>`;
    };
    $('#v-kpi', w).innerHTML =
      kcard(t.avg_assign_to_receive, 'd1', 'มอบหมาย → รับสินค้า', 'ความเร็วในการเข้ารับงาน')
      + kcard(t.avg_receive_to_return, 'd2', 'รับสินค้า → นำกลับคลัง', 'ระยะเวลาดำเนินการ')
      + kcard(t.avg_receive_to_complete, 'd3', 'รับสินค้า → ปิดงาน', 'รวมจนจบกระบวนการ');
  }).catch((e) => {
    $('#v-actions', w).innerHTML = `<div class="empty err">${esc(e.message)}</div>`;
  });

  return w;
}

function vSkeleton(n) { return Array.from({ length: n }, () => '<div class="vskel"></div>').join(''); }

// ---------- shared order detail html + QR ----------
function orderDetailHtml(o) {
  return `<div class="d-no">${esc(o.rg_no)}</div>
    <div class="kv"><span>สถานะ</span><span>${statusChip(o.status)}</span></div>
    ${o.reference ? `<div class="kv"><span>Reference</span><span>${esc(o.reference)}</span></div>` : ''}
    <div class="kv"><span>ร้านค้า</span><span>${esc(o.sold_to_name || '-')}</span></div>
    <div class="kv"><span>จำนวน</span><span>${o.qty_boxes ?? 0} กล่อง · ${o.qty_pieces ?? 0} ชิ้น</span></div>
    ${o.gr_remark ? `<div class="kv"><span>Remark (คลัง)</span><span class="gr-remark">${esc(o.gr_remark)}</span></div>` : ''}
    <div class="kv"><span>วันที่มอบหมาย</span><span>${o.assigned_at ? fmtDate(o.assigned_at) : '-'}</span></div>
    <div class="kv"><span>วันที่รับสินค้า</span><span>${o.received_date ? fmtDate(o.received_date) : '-'}</span></div>
    <div class="kv"><span>วันกลับคลัง</span><span>${o.returned_date ? fmtDate(o.returned_date) : '-'}</span></div>
    <div class="kv"><span>วันปิดงาน (Doc. WH)</span><span>${o.completed_date ? fmtDate(o.completed_date) : '-'}</span></div>
    ${o.completed_file_url ? `<div class="kv"><span>เอกสารจบงาน</span><a href="${esc(o.completed_file_url)}" target="_blank">เปิดไฟล์</a></div>` : ''}
    <div class="qr-wrap"><div id="qr-here"></div><span class="hint">QR เลขที่ RG</span></div>`;
}

// ============ shell / router ============
let activeView = null;
function reloadActive() { if (activeView && activeView._load) activeView._load(); }

// ไปยังแท็บอื่น (คลิกปุ่มแท็บที่ตรงกับ label) — ใช้จากปุ่มลัดใน Dashboard
function jumpTo(view) {
  const btn = [...$('#tabs').querySelectorAll('.tab')].find((b) => b.textContent === view.label);
  if (btn) btn.click(); else show(view);
}

function renderShell() {
  // หัวเว็บแสดงแค่ชื่อระบบ — ไม่โชว์ role (ตั้งค่าไว้ใน index.html แล้ว)
  $('#who').textContent = `${me.display_name || me.username}`;
  const items = menuFor(me.role);
  const tabs = $('#tabs'); tabs.innerHTML = '';
  items.forEach((v, i) => {
    const b = el(`<button class="tab ${i === 0 ? 'active' : ''}">${v.label}</button>`);
    b.onclick = () => { tabs.querySelectorAll('.tab').forEach((t) => t.classList.remove('active')); b.classList.add('active'); show(v); };
    tabs.appendChild(b);
  });
  if (items[0]) show(items[0]);
  checkArchiveBanner();
}

// ---------- Archive banner (Supervisor เท่านั้น) ----------
// เตือนเมื่อมี order ปิดงาน + เก่ากว่า 6 เดือน → ดาวน์โหลด → ยืนยันลบ 2 ขั้น
async function checkArchiveBanner() {
  const box = $('#archive-banner');
  if (!box) return;
  box.innerHTML = '';
  if (!['supervisor', 'admin'].includes(me.role)) return;
  let info;
  try { info = await api('/admin/archive/count'); } catch { return; }
  if (!info || !info.count) return; // ไม่มีอะไรต้อง archive — แบนเนอร์หายเอง

  const bar = el(`<div class="archive-bar">
    <span class="ab-msg">🗄️ มี <b>${info.count}</b> ออเดอร์ที่ปิดงานเกิน ${info.months} เดือน (ก่อน ${info.cutoff}) พร้อม Archive</span>
    <span class="ab-actions">
      <button class="btn ghost" id="ab-dl">⬇️ ดาวน์โหลด Excel</button>
      <button class="btn red hidden" id="ab-del">🗑️ ยืนยันลบข้อมูล (${info.count})</button>
    </span>
  </div>`);
  box.appendChild(bar);

  const dlBtn = $('#ab-dl', bar);
  const delBtn = $('#ab-del', bar);

  dlBtn.onclick = () => {
    // ดาวน์โหลดไฟล์ลงเครื่องผ่าน token ใน query (endpoint เป็น GET)
    window.open(withToken('/api/admin/archive/download'), '_blank');
    // เปิดปุ่มลบขั้นที่ 2 หลังสั่งดาวน์โหลด
    dlBtn.textContent = '⬇️ ดาวน์โหลดอีกครั้ง';
    delBtn.classList.remove('hidden');
    toast('ดาวน์โหลดแล้ว — ตรวจไฟล์ให้ครบก่อนกดยืนยันลบ');
  };

  delBtn.onclick = async () => {
    if (!confirm(`ยืนยันลบ ${info.count} ออเดอร์ออกจากระบบถาวร?\nโปรดแน่ใจว่าดาวน์โหลดไฟล์ Excel เก็บไว้แล้ว — ข้อมูลที่ลบเอาคืนไม่ได้`)) return;
    delBtn.disabled = true;
    try {
      const r = await api('/admin/archive', { method: 'DELETE' });
      toast(`ลบแล้ว ${r.deleted} ออเดอร์`);
      checkArchiveBanner();      // เช็คใหม่ — ถ้าหมดแล้วแบนเนอร์หาย
      reloadActive();            // รีเฟรชหน้าปัจจุบันให้ตัวเลขตรง (ถ้าหน้ารองรับ)
    } catch (e) {
      alert('ลบไม่สำเร็จ: ' + e.message);
      delBtn.disabled = false;
    }
  };
}

function show(view) {
  const main = $('#main'); main.innerHTML = '';
  try {
    activeView = view.render();
    main.appendChild(activeView);
  } catch (e) {
    // อย่าปล่อยให้หน้าว่างเงียบๆ — แสดง error ให้เห็น
    console.error('render view failed:', view.id, e);
    main.innerHTML = `<div class="empty err">หน้านี้แสดงผลไม่ได้: ${esc(e.message)}</div>`;
  }
}

// ---------- modal ----------
function openModal(html) {
  $('#modal-body').innerHTML = html;
  $('#modal').classList.remove('hidden');
  const qrHere = $('#qr-here');
  if (qrHere) {
    const rgNo = ($('#modal-body .d-no')?.textContent || '').split(' ')[0];
    try { if (rgNo) qrHere.appendChild(window.QR.toCanvas(rgNo, { scale: 4 })); } catch {}
  }
}
function closeModal() { $('#modal').classList.add('hidden'); $('#modal-body').innerHTML = ''; }
$('#modal-close').onclick = closeModal;
$('#modal').onclick = (e) => { if (e.target.id === 'modal') closeModal(); };

// ---------- toast ----------
function toast(msg) {
  const t = el(`<div class="toast">${esc(msg)}</div>`);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// ---------- auth ----------
function showLogin() { $('#login').classList.remove('hidden'); $('#app').classList.add('hidden'); }
async function showApp() {
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  // โหลดหมวด + เกณฑ์ KPI + รายชื่อ Vendor ก่อน render (Vendor ใช้แสดงชื่อในตารางออเดอร์)
  await Promise.all([loadNoteCategories(), loadKpiLimits(), loadVendorList()]);
  renderShell();
}
function doLogout(silent) {
  if (!silent) api('/auth/logout', { method: 'POST' }).catch(() => {});
  token = ''; me = null; localStorage.removeItem('cntms_token'); showLogin();
}
$('#logout').onclick = () => doLogout(false);

// ---------- change password (ทุก role) ----------
function openChangePassword() {
  openModal(`<div class="d-no">เปลี่ยนรหัสผ่าน</div>
    <label class="hint">รหัสผ่านปัจจุบัน</label>
    <input id="cp_cur" type="password" class="in" autocomplete="current-password"/>
    <label class="hint">รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)</label>
    <input id="cp_new" type="password" class="in" autocomplete="new-password"/>
    <label class="hint">ยืนยันรหัสผ่านใหม่</label>
    <input id="cp_new2" type="password" class="in" autocomplete="new-password"/>
    <button class="btn primary" id="cp_save">บันทึกรหัสผ่านใหม่</button>
    <div id="m-err" class="err"></div>`);
  $('#cp_save').onclick = async () => {
    const cur = $('#cp_cur').value, nw = $('#cp_new').value, nw2 = $('#cp_new2').value;
    const err = $('#m-err');
    if (!cur || !nw) { err.textContent = 'กรุณากรอกให้ครบ'; return; }
    if (nw.length < 6) { err.textContent = 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร'; return; }
    if (nw !== nw2) { err.textContent = 'รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน'; return; }
    try {
      await api('/auth/password', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: cur, new_password: nw }),
      });
      closeModal(); toast('เปลี่ยนรหัสผ่านเรียบร้อย');
    } catch (e) { err.textContent = e.message; }
  };
}
// กัน index.html เก่าใน cache ที่ยังไม่มีปุ่ม — อย่าให้ทั้งแอปพัง
const chpassBtn = $('#chpass');
if (chpassBtn) chpassBtn.onclick = openChangePassword;

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#login-err'); err.textContent = '';
  try {
    const r = await api('/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: $('#login-user').value.trim(), password: $('#login-pass').value }),
    });
    token = r.token; me = r.user; localStorage.setItem('cntms_token', token);
    $('#login-pass').value = ''; showApp();
  } catch (ex) { err.textContent = ex.message; }
});

// boot
if (token) {
  api('/auth/me').then((r) => { me = r.user; showApp(); }).catch(() => showLogin());
} else showLogin();
