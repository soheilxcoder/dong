import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { r } from './routes.js';
import { HttpError, auth } from './lib.js';
import { startCron } from './cron.js';
import './db.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './data/uploads';
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const origins = (process.env.CORS_ORIGIN ?? '*').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.includes('*') ? true : origins }));
app.use(express.json({ limit: '3mb' }));

/* ---------- API (mounted at /api, and also at / for backwards compatibility) ---------- */
const api = express.Router();
api.get('/health', (_q, s) => s.json({ ok: true, name: 'dong-api', version: process.env.npm_package_version ?? '1.0.0', time: new Date().toISOString() }));
const upload = multer({
  storage: multer.diskStorage({ destination: UPLOAD_DIR, filename: (_q, f, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${(path.extname(f.originalname) || '.jpg').toLowerCase()}`) }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_q, f, cb) => cb(null, /^image\//.test(f.mimetype)),
});
api.post('/uploads', auth, upload.single('file'), (req, res) => { if (!req.file) return res.status(400).json({ code: 'NO_FILE', message: 'فایل تصویر ارسال نشده' }); res.json({ url: `/api/uploads/${req.file.filename}` }); });
api.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true }));
api.use(r);
app.use('/api', api);
app.use(api);

/* ---------- Web app (optional): serve the built PWA from the same server ---------- */
const here = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = process.env.WEB_DIR ?? [path.resolve(here, '../web'), path.resolve('web'), path.resolve(here, '../../web/dist'), path.resolve('../web/dist')].find((p) => fs.existsSync(path.join(p, 'index.html')));
if (WEB_DIR && fs.existsSync(path.join(WEB_DIR, 'index.html'))) {
  app.use(express.static(WEB_DIR, { index: 'index.html', maxAge: '1h', setHeaders: (res, p) => { if (/\/assets\//.test(p)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); if (p.endsWith('sw.js') || p.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache'); } }));
  app.get(/^(?!\/api\/).*/, (_q, res) => res.sendFile(path.join(WEB_DIR, 'index.html')));
  console.log(`serving web app from ${WEB_DIR}`);
}

app.use((err: unknown, _q: express.Request, res: express.Response, _n: express.NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ code: err.code, message: err.message });
  if ((err as { type?: string }).type === 'entity.too.large') return res.status(413).json({ code: 'TOO_LARGE', message: 'حجم درخواست زیاد است' });
  console.error(err);
  res.status(500).json({ code: 'INTERNAL', message: 'خطای داخلی سرور' });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, '0.0.0.0', () => { console.log(`dong server listening on http://0.0.0.0:${port}  (db: ${process.env.DATABASE_FILE ?? './data/dong.db'})`); startCron(); });
