import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

import authRoutes from './routes/auth.js';
import rgRoutes from './routes/rg.js';
import pdfRoutes from './routes/pdf.js';
import ordersRoutes from './routes/orders.js';
import adminRoutes from './routes/admin.js';
import dashboardRoutes from './routes/dashboard.js';
import kpiRoutes from './routes/kpi.js';
import lookupRoutes from './routes/lookup.js';
import { requireAuth } from './lib/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'cntms', time: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/rg', requireAuth, rgRoutes);
app.use('/api/pdf', requireAuth, pdfRoutes);
app.use('/api/orders', requireAuth, ordersRoutes);
app.use('/api/admin', requireAuth, adminRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/kpi', requireAuth, kpiRoutes);
app.use('/api/lookup', requireAuth, lookupRoutes);

// serve frontend static build (single-page)
const frontendDir = path.join(__dirname, '../../frontend/public');
app.use(express.static(frontendDir));
app.get('*', (_req, res) => res.sendFile(path.join(frontendDir, 'index.html')));

const PORT = process.env.PORT || 4700;
app.listen(PORT, () => console.log(`[cntms] backend listening on http://localhost:${PORT}`));
