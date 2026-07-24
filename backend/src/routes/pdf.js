import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { transportFormPDF, receiptFormPDF } from '../lib/pdf.js';

const router = Router();

async function loadRG(rgNo) {
  const { data: header } = await supabase
    .from('rg_headers').select('*').eq('rg_no', rgNo).maybeSingle();
  if (!header) return null;
  const { data: items } = await supabase
    .from('rg_items').select('*').eq('rg_no', rgNo).order('id');
  return { ...header, items: items || [] };
}

function stream(res, doc, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  doc.pipe(res);
}

// GET /api/pdf/:rgNo/transport — ใบแจ้งให้ขนส่งไปรับคืนสินค้า
router.get('/:rgNo/transport', async (req, res) => {
  const rg = await loadRG(req.params.rgNo);
  if (!rg) return res.status(404).json({ error: 'ไม่พบเลขที่ RG นี้' });
  stream(res, transportFormPDF(rg), `WH_${rg.rg_no}.pdf`);
});

// GET /api/pdf/:rgNo/receipt — เอกสารแทนใบรับคืนสินค้า
router.get('/:rgNo/receipt', async (req, res) => {
  const rg = await loadRG(req.params.rgNo);
  if (!rg) return res.status(404).json({ error: 'ไม่พบเลขที่ RG นี้' });
  stream(res, receiptFormPDF(rg), `RG_${rg.rg_no}.pdf`);
});

export default router;
