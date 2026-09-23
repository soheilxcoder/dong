import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { r } from './routes.js';
import { HttpError, auth } from './lib.js';
import { startCron } from './cron.js';

const app = express();
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './uploads';
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(cors({ origin: (process.env.CORS_ORIGIN ?? '*').split(',').map((s) => s.trim()) }));
app.use(express.json({ limit: '2mb' }));
app.get('/health', (_q, s) => s.json({ ok: true, name: 'dong-api', version: '1.0.0' }));

// Receipt / avatar uploads (local disk; swap for S3 in production)
const upload = multer({ storage: multer.diskStorage({ destination: UPLOAD_DIR, filename: (_q, f, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(f.originalname) || '.jpg'}`) }), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_q, f, cb) => cb(null, /^image\//.test(f.mimetype)) });
app.post('/uploads', auth, upload.single('file'), (req, res) => { if (!req.file) return res.status(400).json({ code: 'NO_FILE', message: 'فایل تصویر ارسال نشده' }); res.json({ url: `/uploads/${req.file.filename}` }); });
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true }));

app.use(r);

app.use((err: unknown, _q: express.Request, res: express.Response, _n: express.NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ code: err.code, message: err.message });
  console.error(err);
  res.status(500).json({ code: 'INTERNAL', message: 'خطای داخلی سرور' });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, '0.0.0.0', () => { console.log(`dong-api listening on :${port}`); startCron(); });
