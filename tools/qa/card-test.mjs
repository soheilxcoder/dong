// QA: register without card -> profile -> save card -> reload -> verify. Serves a built folder under /dong/.
// usage: LD_LIBRARY_PATH=.cache/chromium/lib node tools/qa/card-test.mjs <folder-with-index.html> [width height]
import { createRequire } from 'module'; import path from 'path'; import fs from 'fs'; import http from 'http';
const require = createRequire(import.meta.url); const puppeteer = require('puppeteer-core');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const dist = path.resolve(process.argv[2] ?? 'docs'); const W = +(process.argv[3] ?? 1366), H = +(process.argv[4] ?? 650);
const mime = { html: 'text/html', js: 'text/javascript', css: 'text/css', png: 'image/png', webp: 'image/webp', svg: 'image/svg+xml', woff2: 'font/woff2', json: 'application/json', webmanifest: 'application/manifest+json' };
const srv = http.createServer((req, res) => { let f = path.join(dist, decodeURIComponent(req.url.split('?')[0]).replace(/^\/dong/, '')); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html'); res.setHeader('Content-Type', mime[f.split('.').pop()] || 'application/octet-stream'); fs.createReadStream(f).pipe(res); }).listen(8097);
const b = await puppeteer.launch({ executablePath: root + '/.cache/chromium/chromium', args: ['--no-sandbox', '--disable-gpu', '--single-process', '--no-zygote'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const p = await b.newPage(); await p.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
p.on('console', (m) => { if (m.type() === 'error' && !/wss:/.test(m.text())) console.log('CONSOLE', m.text()); });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
const U = 'http://localhost:8097/dong/';
await p.goto(U, { waitUntil: 'networkidle0' }); await sleep(1500); // let SW install like a real user
await p.goto(U + '#/onboarding', { waitUntil: 'networkidle0' }); await sleep(800);
// go through onboarding like a user: click "بعدی"/"شروع" until auth
for (let i = 0; i < 6; i++) { const h = await p.evaluate(() => location.hash); if (h.startsWith('#/auth')) break; await p.$$eval('button', (bs) => bs.find((x) => /بعدی|شروع|رد کردن/.test(x.textContent || ''))?.click()); await sleep(500); }
console.log('hash after onboarding:', await p.evaluate(() => location.hash));
await p.$$eval('button', (bs) => bs.find((x) => (x.textContent || '').trim() === 'ثبت‌نام')?.click()); await sleep(300);
for (const [ph, v] of [['مثلاً علی رضایی', 'علی رضایی'], ['ali_r', 'ali_' + Date.now().toString(36).slice(-4)], ['••••••', 'dong1234']]) { const el = await p.$(`input[placeholder="${ph}"]`); await el.type(v); }
await p.$$eval('button.btn-primary', (bs) => bs[0].click()); await sleep(2000);
console.log('hash after register:', await p.evaluate(() => location.hash));
// dismiss home tour like a user (click رد کردن)
await p.$$eval('button', (bs) => bs.find((x) => /رد کردن/.test(x.textContent || ''))?.click()); await sleep(400);
// navigate via bottom nav to profile
await p.$$eval('a', (as) => as.find((a) => a.getAttribute('href')?.endsWith('#/profile'))?.click()); await sleep(1500);
console.log('hash:', await p.evaluate(() => location.hash));
// profile tour may be showing: dismiss
await p.$$eval('button', (bs) => bs.find((x) => /رد کردن/.test(x.textContent || ''))?.click()); await sleep(400);
await p.screenshot({ path: "/tmp/profile.png" }); console.log("profile text:", (await p.evaluate(() => document.body.innerText)).slice(0, 400)); await p.click('[data-tour="card"]'); await sleep(700);
const inp = await p.$('input[placeholder="6037 9917 0000 0000"]'); if (!inp) { console.log('NO CARD INPUT; sheet not open?'); await p.screenshot({ path: '/tmp/card-fail.png' }); }
await inp.click(); await inp.type('6037991712349876'); await sleep(200);
const btn = await p.$('button[type=submit]') ?? (await p.$$('button')).at(-1);
const bb = await btn.boundingBox(); console.log('save btn', bb, await p.evaluate((b) => { const e = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return e && e.tagName + '.' + String(e.className).slice(0, 40); }, bb));
await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await sleep(1500);
const text = await p.evaluate(() => document.body.innerText);
console.log('toast ok?', text.includes('ذخیره شد'), '| sheet still open?', !!(await p.$('input[placeholder="6037 9917 0000 0000"]')), '| shows card?', text.includes('6037'));
await p.reload({ waitUntil: 'networkidle0' }); await sleep(1500);
console.log('after reload shows card?', (await p.evaluate(() => document.body.innerText)).includes('6037'));
await p.screenshot({ path: '/tmp/card-final.png' });
await b.close(); srv.close();
