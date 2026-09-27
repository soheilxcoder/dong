// Documentation screenshots — every screen of the app, saved small (JPEG) for the user guide.
// 1) build web:  VITE_BASE=/ VITE_PUBLIC_URL=https://products.arounidea.com/dong/ npm run build -w @dong/web
// 2) run:        npm run shots:docs
// Output: apps/web/public/guide/img/*.jpg (also used by docs-src/USER_GUIDE.md)
import { createRequire } from 'module'; import path from 'path'; import fs from 'fs'; import http from 'http';
const require = createRequire(import.meta.url); const puppeteer = require('puppeteer-core');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const out = path.join(root, 'apps/web/public/guide/img'); fs.mkdirSync(out, { recursive: true });
const PORT = 8094; const dist = path.join(root, 'apps/web/dist');
const mime = { html: 'text/html', js: 'text/javascript', css: 'text/css', png: 'image/png', webp: 'image/webp', svg: 'image/svg+xml', woff2: 'font/woff2', json: 'application/json', webmanifest: 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  let f = path.join(dist, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html');
  res.setHeader('Content-Type', mime[f.split('.').pop()] || 'application/octet-stream'); fs.createReadStream(f).pipe(res);
}).listen(PORT);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: root + '/.cache/chromium/chromium', args: ['--no-sandbox', '--disable-gpu', '--single-process', '--no-zygote', '--font-render-hinting=none'] });
const p = await b.newPage();
await p.setViewport({ width: 412, height: 892, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true });
await p.emulateTimezone('Asia/Tehran');
const url = `http://localhost:${PORT}/`;
const shot = (n) => p.screenshot({ path: `${out}/${n}.jpg`, type: 'jpeg', quality: 82 });
const hideToasts = () => p.addStyleTag({ content: '.z-\\[60\\]{display:none!important} *{caret-color:transparent!important}' });
const clickText = async (re) => p.$$eval('button,a,[role=button]', (bs, src) => { const r = new RegExp(src); const el = bs.find((x) => r.test((x.textContent || '').trim())); if (el) { el.click(); return true; } return false; }, re.source);
const type = async (ph, v) => { const el = await p.$(`input[placeholder="${ph}"]`); if (!el) return; await el.focus(); await el.click({ clickCount: 3 }).catch(() => {}); await el.type(v, { delay: 5 }); };
const go = async (hash, wait = 1500) => { await p.goto(url + '#' + hash, { waitUntil: 'networkidle0' }); await p.reload({ waitUntil: 'networkidle0' }); await sleep(wait); await hideToasts(); await p.evaluate(() => window.scrollTo(0, 0)); };
const tab = async (v) => { await p.click(`[data-tour="tab-${v}"]`); await sleep(900); };

// ---- 0. onboarding (fresh) ----
await p.goto(url, { waitUntil: 'networkidle0' });
await p.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('dong'); });
await go('/onboarding', 1800); await shot('00-onboarding');

// ---- 1. auth (register) ----
await p.evaluate(() => {
  const tours = Object.fromEntries(['home', 'group', 'invite', 'settle', 'expense', 'profile'].map((k) => [k, true]));
  localStorage.setItem('dong.settings', JSON.stringify({ theme: 'light', sound: true, notifications: true, onboarded: true, apiUrl: 'local', tours }));
});
await go('/auth', 1200);
await clickText(/^ثبت‌نام$/); await sleep(400);
await type('مثلاً علی رضایی', 'علی رضایی'); await type('ali_r', 'ali_r'); await type('••••••', 'dong1234'); await type('6037 9917 •••• ••••', '6037997599999993');
await p.evaluate(() => document.activeElement?.blur()); await sleep(300); await shot('01-register');
await p.$$eval('button.btn-primary', (bs) => bs[0].click());
await p.waitForFunction(() => location.hash === '#/' || location.hash === '', { timeout: 15000 }); await sleep(1200);

// ---- 2. empty home ----
await go('/', 1800); await shot('02-home-empty');

// ---- 3. new group ----
await go('/new-group', 1200);
await type('مثلاً سفر شمال، خونه بچه‌ها، …', 'سفر کیش').catch(() => {});
await p.evaluate(() => document.activeElement?.blur()); await sleep(300); await shot('03-new-group');

// demo group (dev mode button on home)
await p.evaluate(() => localStorage.setItem('dong.dev', '1'));
await go('/', 1500); await clickText(/گروه نمونه|نمونه/); await sleep(1500);
const gid = await p.evaluate(() => new Promise((res) => { const r = indexedDB.open('dong'); r.onsuccess = () => { const tx = r.result.transaction('groups').objectStore('groups').getAll(); tx.onsuccess = () => res(tx.result[0]?.id); }; }));
await p.evaluate(() => localStorage.setItem('dong.dev', '0'));

// ---- 4. home with data ----
await go('/', 2000); await shot('04-home');

// ---- 5. group tabs ----
await go(`/g/${gid}`, 1800); await shot('05-group-expenses');
await tab('settle'); await shot('07-group-settle');
if (await clickText(/^ثبت پرداخت$/)) { await sleep(900); await shot('08-pay-sheet'); }
await go(`/g/${gid}`, 1200); await tab('activity'); await shot('09-activity');
await tab('members'); await shot('10-members');

// ---- 11. expense form ----
await go(`/g/${gid}/expense/new`, 1300);
await type('مثلاً شام، تاکسی، بلیط…', 'شام ساحلی');
const amt = await p.$('input[inputmode="numeric"]'); if (amt) { await amt.click(); await amt.type('1250000', { delay: 5 }); }
await p.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); }); await sleep(500); await shot('11-expense-form');
if (await clickText(/^دلخواه$/)) { await sleep(600); await p.evaluate(() => window.scrollTo(0, 400)); await sleep(300); await shot('13-expense-custom-split'); }

// ---- 14. expense detail ----
await go(`/g/${gid}`, 1500);
const expId = await p.evaluate(() => new Promise((res) => { const r = indexedDB.open('dong'); r.onsuccess = () => { const tx = r.result.transaction('expenses').objectStore('expenses').getAll(); tx.onsuccess = () => res(tx.result[0]?.id); }; }));
if (expId) { await go(`/g/${gid}/expense/${expId}`, 1500); await shot('14-expense-detail'); }

// ---- 15/16. invite + join ----
await go(`/g/${gid}/invite`, 1800); await shot('15-invite');
await go('/join/DEMO-TOKEN', 1500); await shot('16-join');

// ---- 17. activity (global) ----
await go('/activity', 1500); await shot('17-activity-all');

// ---- 18-20. profile, help, card ----
await go('/profile', 1500); await shot('18-profile');
if (await clickText(/راهنمای استفاده/)) { await sleep(900); await shot('19-help'); await p.keyboard.press('Escape'); await sleep(300); }
await go('/profile', 1200);
if (await clickText(/شماره کارت|کارت بانکی/)) { await sleep(800); await shot('20-card-editor'); await p.keyboard.press('Escape'); }

// ---- 21-22. dark mode ----
await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('dong.settings')); s.theme = 'dark'; localStorage.setItem('dong.settings', JSON.stringify(s)); });
await go('/', 2000); await shot('21-dark-home');
await go(`/g/${gid}`, 1800); await tab('settle'); await shot('22-dark-settle');

await p.close(); await b.close(); srv.close();
console.log('done →', out, fs.readdirSync(out).length, 'images');
