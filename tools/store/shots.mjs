// Store screenshots generator (Bazaar / Myket / Google Play).
// 1) build web:  VITE_BASE=/ VITE_PUBLIC_URL=https://soheilxcoder.github.io/dong/ npm run build -w @dong/web
// 2) run:        npm run shots
// Output: store-assets/screenshots/0N-*.png (1080x1920) + raw/ (device captures)
import { createRequire } from 'module'; import path from 'path'; import fs from 'fs'; 
const require = createRequire(import.meta.url); const puppeteer = require('puppeteer-core');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const out = path.join(root, 'store-assets/screenshots'); fs.mkdirSync(out + '/raw', { recursive: true });
const PORT = 8093;
import http from 'http';
const dist = path.join(root, 'apps/web/dist');
const mime = { html: 'text/html', js: 'text/javascript', css: 'text/css', png: 'image/png', webp: 'image/webp', svg: 'image/svg+xml', woff2: 'font/woff2', json: 'application/json', webmanifest: 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  let f = path.join(dist, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html');
  res.setHeader('Content-Type', mime[f.split('.').pop()] || 'application/octet-stream'); fs.createReadStream(f).pipe(res);
}).listen(PORT);
await new Promise((r) => setTimeout(r, 300));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: root + '/.cache/chromium/chromium', args: ['--no-sandbox', '--disable-gpu', '--single-process', '--no-zygote', '--font-render-hinting=none'] });
const p = await b.newPage();
await p.setViewport({ width: 412, height: 892, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true });
await p.emulateTimezone('Asia/Tehran');
const url = `http://localhost:${PORT}/`;
await p.goto(url, { waitUntil: 'networkidle0' });
await p.evaluate(() => {
  const tours = Object.fromEntries(['home', 'group', 'invite', 'settle', 'expense', 'profile'].map((k) => [k, true]));
  localStorage.setItem('dong.settings', JSON.stringify({ theme: 'light', sound: true, notifications: true, onboarded: true, apiUrl: '', tours }));
});
await p.goto(url + '#/auth', { waitUntil: 'networkidle0' }); await p.reload({ waitUntil: 'networkidle0' }); await sleep(800);
const type = async (ph, v) => { const el = await p.$(`input[placeholder="${ph}"]`); await el.click({ clickCount: 3 }); await el.type(v, { delay: 5 }); };
// switch to register mode if needed
await p.$$eval('button', (bs) => bs.find((x) => (x.textContent || '').trim() === 'ثبت‌نام')?.click());
await sleep(400);
await type('مثلاً علی رضایی', 'علی رضایی'); await type('ali_r', 'ali_r'); await type('••••••', 'dong1234'); await type('6037 9917 •••• ••••', '6037991712349876');
await p.$$eval('button.btn-primary', (bs) => bs[0].click());
await p.waitForFunction(() => location.hash === '#/' || location.hash === '', { timeout: 15000 }); await sleep(1200);
// demo group
await p.$$eval('button', (bs) => bs.find((x) => /گروه نمونه|نمونه/.test(x.textContent || ''))?.click());
await sleep(1500);
// find group id via IndexedDB
const gid = await p.evaluate(() => new Promise((res) => { const r = indexedDB.open('dong'); r.onsuccess = () => { const tx = r.result.transaction('groups').objectStore('groups').getAll(); tx.onsuccess = () => res(tx.result[0]?.id); }; }));
const go = async (hash, wait = 1600) => { await p.goto(url + '#' + hash, { waitUntil: 'networkidle0' }); await p.reload({ waitUntil: 'networkidle0' }); await sleep(wait); await p.evaluate(() => window.scrollTo(0, 0)); };
const shot = (n) => p.screenshot({ path: `${out}/raw/${n}.png` });
const clickTab = async (v) => { await p.click(`[data-tour="tab-${v}"]`); await sleep(900); };
const hideToasts = () => p.addStyleTag({ content: '.z-\[60\]{display:none!important} *{caret-color:transparent!important}' });

await go('/', 2200); await hideToasts(); await shot('01');
await go(`/g/${gid}`, 2000); await hideToasts(); await shot('02');
await clickTab('settle'); await shot('03');
await go(`/g/${gid}/expense/new`, 1500); await hideToasts();
await type('مثلاً شام، تاکسی، بلیط…', 'شام ساحلی');
const amt = await p.$('input[inputmode="numeric"]'); if (amt) { await amt.click(); await amt.type('1250000', { delay: 5 }); }
await p.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); document.querySelectorAll('main,[class*=overflow-y]').forEach((e) => (e.scrollTop = 0)); }); await sleep(600); await shot('04');
await go(`/g/${gid}`, 1500); await hideToasts(); await clickTab('activity'); await shot('05');
await go(`/g/${gid}/invite`, 2000); await hideToasts(); await shot('06');
await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('dong.settings')); s.theme = 'dark'; localStorage.setItem('dong.settings', JSON.stringify(s)); });
await go(`/g/${gid}`, 2200); await hideToasts(); await clickTab('settle'); await shot('07');
await p.close();

// ---------- compose store frames ----------
const slides = [
  ['01', 'خلاصهٔ حساب در یک نگاه', 'کی به کی چقدر بدهکاره؟', 'دُنگ همهٔ رفت‌وبرگشت‌ها را جمع می‌زند و یک عدد ساده نشانت می‌دهد.', '#0FB88A', '#0891B2'],
  ['02', 'گروه برای هر سفر و دورهمی', 'هزینه‌ها را همان لحظه ثبت کن', 'هر کی حساب کرد، دو ضربه کافی است. سهم هر نفر خودکار حساب می‌شود.', '#0E9F6E', '#1D4ED8'],
  ['03', 'تسویه با کمترین تراکنش', 'هوشمندانه صاف می‌شود', 'به‌جای ده‌ها پرداخت، فقط چند تا. شماره کارت هم همان‌جا با یک ضربه کپی می‌شود.', '#0891B2', '#7C3AED'],
  ['04', 'تقسیم مساوی، دلخواه یا حسابگر', 'فقط کسایی که بودن', 'پیش‌نمایش زندهٔ سهم هر نفر، قبل از ثبت. رسید هم ضمیمه کن.', '#0FB88A', '#F59E0B'],
  ['05', 'شفافیت کامل', 'همه‌چیز ثبت می‌شود', 'هر هزینه، ویرایش، پرداخت و تأیید در تاریخچهٔ گروه می‌ماند تا هیچ‌کس گیج نشود.', '#0891B2', '#0FB88A'],
  ['06', 'دعوت با QR یا لینک', 'بدون ثبت‌نام اضافه', 'دوستت اسکن می‌کند و عضو می‌شود؛ حتی اگر اپ نداشته باشد، نسخهٔ وب باز می‌شود.', '#059669', '#0891B2'],
  ['07', 'حالت تاریک', 'چشم‌نواز در شب', 'رابط کاملاً فارسی و راست‌چین با فونت وزیرمتن، روشن یا تاریک.', '#0F1416', '#134E4A'],
];
const font = fs.readFileSync(path.join(root, 'apps/web/src/assets/Vazirmatn.woff2')).toString('base64');
const html = (n, tag, title, sub, c1, c2) => `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:V;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900}
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;font-family:V,sans-serif;color:#fff}
body{background:radial-gradient(120% 70% at 85% 0%,${c2}cc 0%,transparent 60%),radial-gradient(90% 60% at 0% 100%,${c2}99 0%,transparent 60%),linear-gradient(160deg,${c1},${c2} 130%)}
.glow{position:absolute;inset:0;background:radial-gradient(60% 40% at 50% 100%,#ffffff22,transparent 70%)}
.hd{position:absolute;top:110px;left:80px;right:80px;text-align:center}
.tag{display:inline-block;background:#ffffff26;backdrop-filter:blur(8px);border:1px solid #ffffff44;border-radius:999px;padding:12px 30px;font-size:30px;font-weight:600}
h1{font-size:76px;font-weight:800;margin:36px 0 22px;line-height:1.25;letter-spacing:-.5px}
p{font-size:34px;line-height:1.75;margin:0;opacity:.92;font-weight:500}
.ph{position:absolute;left:50%;top:600px;transform:translateX(-50%);width:780px;height:1700px;border-radius:90px;background:#0b0f12;padding:18px;box-shadow:0 60px 120px -30px #00000099,0 0 0 2px #ffffff22 inset}
.sc{width:100%;height:100%;border-radius:78px;overflow:hidden;background:#fff;position:relative}
.sc img{width:100%;display:block}
.cam{position:absolute;top:44px;left:50%;transform:translateX(-50%);width:40px;height:40px;border-radius:50%;background:#000;box-shadow:0 0 0 6px #0b0f12}
</style></head><body><div class="glow"></div>
<div class="hd"><span class="tag">${tag}</span><h1>${title}</h1><p>${sub}</p></div>
<div class="ph"><div class="sc"><img src="file://${out}/raw/${n}.png"></div><div class="cam"></div></div></body></html>`;
const names = { '01': 'home', '02': 'group', '03': 'settle', '04': 'expense', '05': 'activity', '06': 'invite', '07': 'dark' };
const q = await b.newPage(); await q.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
for (const [n, tag, title, sub, c1, c2] of slides) {
  const f = `/tmp/slide-${n}.html`; fs.writeFileSync(f, html(n, tag, title, sub, c1, c2));
  await q.goto('file://' + f, { waitUntil: 'networkidle0' }); await sleep(300);
  await q.screenshot({ path: `${out}/${n}-${names[n]}.png` });
}
await b.close(); srv.close();
console.log('done →', out);
