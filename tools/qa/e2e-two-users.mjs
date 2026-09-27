// Two-browser end-to-end test against the real PHP API (run tools/qa/php-server first, see README in file header of e2e).
// usage: LD_LIBRARY_PATH=.cache/chromium/lib node tools/qa/e2e-two-users.mjs [baseUrl]
import { createRequire } from 'module'; import path from 'path'; import fs from 'fs';
const require = createRequire(import.meta.url); const puppeteer = require('puppeteer-core');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const BASE = process.argv[2] || 'http://localhost:8096/'; const out = '/tmp/e2e'; fs.mkdirSync(out, { recursive: true });
const LOG = []; { const o = console.log.bind(console); console.log = (...a) => { LOG.push(a.join(' ')); o(...a); }; }
const report = () => { if (!process.env.GITHUB_ACTIONS) return; const esc = (t) => String(t).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A'); const all = LOG.join('\n'); for (let i = 0, n = 0; i < all.length && n < 9; i += 3000, n++) process.stdout.write(`::notice title=E2E log ${n + 1}::${esc(all.slice(i, i + 3000))}\n`); };
process.on('uncaughtException', (e) => { console.log('CRASH ' + (e && e.stack || e)); report(); process.exit(2); });
process.on('unhandledRejection', (e) => { console.log('CRASH ' + (e && e.stack || e)); report(); process.exit(2); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = []; const step = (name, ok, extra = '') => { results.push([ok, name, extra]); console.log((ok ? '✅' : '❌') + ' ' + name + (extra ? ' — ' + extra : '')); };
const b = await puppeteer.launch({ executablePath: process.env.CHROME || root + '/.cache/chromium/chromium', args: ['--no-sandbox', '--disable-gpu', '--no-zygote', '--font-render-hinting=none'] });
const mk = async (tag) => {
  const ctx = await b.createBrowserContext(); const p = await ctx.newPage();
  await p.setViewport({ width: 412, height: 892, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true }); await p.emulateTimezone('Asia/Tehran');
  p.on('pageerror', (e) => step(`[${tag}] no page error`, false, String(e).slice(0, 120)));
  p.on('dialog', (d) => d.accept());
  await p.goto(BASE, { waitUntil: 'networkidle0' });
  await p.evaluate(() => { const tours = Object.fromEntries(['home', 'group', 'invite', 'settle', 'expense', 'profile'].map((k) => [k, true])); localStorage.setItem('dong.settings', JSON.stringify({ theme: 'light', sound: false, notifications: false, onboarded: true, tours })); });
  await p.goto(BASE + '#/auth', { waitUntil: 'networkidle0' }); await p.reload({ waitUntil: 'networkidle0' }); await p.waitForSelector('#boot.hide', { timeout: 8000 }); await sleep(500);
  return p;
};
const shot = (p, n) => p.screenshot({ path: `${out}/${n}.png` });
const click = async (p, re, scope = 'button,a,[role=button]') => p.$$eval(scope, (bs, src) => { const r = new RegExp(src); const el = bs.find((x) => r.test((x.textContent || '').trim())); if (el) { el.click(); return true; } return false; }, re.source);
const type = async (p, ph, v) => { const el = await p.$(`input[placeholder="${ph}"]`); if (!el) throw new Error('no input ' + ph); await el.focus(); await el.click({ clickCount: 3 }).catch(() => {}); await el.type(v, { delay: 3 }); };
const text = (p) => p.evaluate(() => document.body.innerText);
const waitText = async (p, re, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (re.test(await text(p))) return Date.now() - t0; await sleep(150); } return -1; };
const suffix = Date.now().toString(36).slice(-5);

// ---------- A registers ----------
const A = await mk('A');
await click(A, /^ثبت‌نام$/); await sleep(300);
await type(A, 'مثلاً علی رضایی', 'علی رضایی'); await type(A, 'ali_r', 'e2e_a_' + suffix); await A.type('input[type=password]', 'dong1234'); await type(A, '6037 9917 •••• ••••', '6037997599999993');
{ const before = await A.$$eval('input[type=password]', (l) => l.length); await A.click('button[aria-label="نمایش رمز"]'); await sleep(150); const after = await A.$$eval('input[type=password]', (l) => l.length); await A.click('button[aria-label="پنهان کردن رمز"]'); await sleep(150); step('A: eye toggles password', before === 1 && after === 0); }
await A.$$eval('button.btn-primary', (bs) => bs[0].click());
step('A: register → home', (await waitText(A, /وضعیت کلی شما|هنوز گروهی نداری/)) >= 0);
// ---------- A creates group ----------
await A.goto(BASE + '#/new-group', { waitUntil: 'networkidle0' }); await sleep(500);
await type(A, 'مثلاً سفر شمال، خونه بچه‌ها، …', 'سفر کیش'); await click(A, /ساخت گروه/); await sleep(1500); await shot(A, 'A-after-create');
{ const ok = (await waitText(A, /دعوت به گروه/)) >= 0; step('A: group created → invite page', ok, ok ? '' : (await text(A)).slice(0, 200).replace(/\n/g, ' ')); }
const inviteUrl = await A.evaluate(() => [...document.querySelectorAll('span[dir=ltr]')].map((s) => s.textContent).find((t) => /#\/join\//.test(t)));
step('A: invite link shown', !!inviteUrl, inviteUrl);
step('A: copy link button exists', await A.$$eval('button', (bs) => bs.some((x) => /کپی لینک/.test(x.textContent))));
step('A: scan QR button exists on invite page', await A.$$eval('button', (bs) => bs.some((x) => /اسکن QR/.test(x.textContent))));
// managed member
await click(A, /افزودن عضو بدون حساب/); await sleep(400); await type(A, 'نام (مثلاً حسین)', 'حسین'); await click(A, /^افزودن$/); 
step('A: managed member added (toast)', (await waitText(A, /اضافه شد/)) >= 0);
await shot(A, 'A-invite');
// ---------- B opens invite link → auth → join ----------
const B = await mk('B');
await B.goto(inviteUrl.startsWith(BASE) ? inviteUrl : inviteUrl.replace(/^https?:\/\/[^/]+\//, BASE), { waitUntil: 'networkidle0' }); await sleep(800);
step('B: redirected to auth (not logged in)', /ثبت‌نام|ورود/.test(await text(B)), (await B.url()) + ' :: ' + (await text(B)).slice(0, 120).replace(/\n/g, ' '));
await click(B, /^ثبت‌نام$/); await sleep(300);
await type(B, 'مثلاً علی رضایی', 'رضا محمدی'); await type(B, 'ali_r', 'e2e_b_' + suffix); await B.type('input[type=password]', 'dong1234');
await B.$$eval('button.btn-primary', (bs) => bs[0].click());
step('B: after register lands on join page', (await waitText(B, /می‌خوای به «سفر کیش» بپیوندی/)) >= 0);
await shot(B, 'B-join');
await click(B, /بله، عضو می‌شم/);
{ const t0 = Date.now(); let ok = false; while (Date.now() - t0 < 10000) { if (/#\/g\//.test(await B.url())) { ok = true; break; } await sleep(150); } step('B: joined → group page', ok, ok ? (Date.now() - t0) + ' ms' : (await text(B)).slice(0, 200).replace(/\n/g, ' ')); }
step('B: no "not your account" screen', !/توی حساب/.test(await text(B)));
// A sees B (realtime)
console.log('B url', await B.url()); const gid = (await B.url()).match(/#\/g\/([^/?]+)/)?.[1];
await A.goto(BASE + '#/', { waitUntil: 'networkidle0' }); await sleep(600);
step('A: home lists the group', /سفر کیش/.test(await text(A)));
await A.goto(BASE + `#/g/${gid}`, { waitUntil: 'networkidle0' }); await sleep(1200); await shot(A, 'A-group-dbg'); console.log('A url', A.url(), (await text(A)).slice(0, 150).replace(/\n/g, ' ')); await A.click('[data-tour="tab-members"]');
if (process.env.RT_STATS) { const st = await fetch(process.env.RT_STATS).then((r) => r.json()).catch(() => ({})); step('realtime hub: both browsers connected via WebSocket', (st.sockets ?? 0) >= 2, JSON.stringify(st)); }
const tA = await waitText(A, /رضا محمدی/, 12000); step('A: sees new member B within 12s', tA >= 0, tA + ' ms');
step('A: sees managed member حسین', /حسین/.test(await text(A)));
await shot(A, 'A-members');
// ---------- B adds expense ----------
await B.goto(BASE + `#/g/${gid}/expense/new`, { waitUntil: 'networkidle0' }); await sleep(600);
await type(B, 'مثلاً شام، تاکسی، بلیط…', 'شام ساحلی'); const amt = await B.$('input[inputmode="numeric"]'); await amt.click(); await amt.type('300000', { delay: 3 });
await B.evaluate(() => window.scrollTo(0, 99999)); await sleep(200);
await B.$$eval('button', (bs) => bs.find((x) => /^ثبت هزینه/.test((x.textContent || '').trim()))?.click());
step('B: expense saved → back in group', (await waitText(B, /شام ساحلی/, 6000)) >= 0);
await shot(B, 'B-expenses');
// A sees the expense
await A.click('[data-tour="tab-expenses"]');
const tE = await waitText(A, /شام ساحلی/, 12000); step('A: sees B\'s expense within 12s', tE >= 0, tE + ' ms');
// ---------- settle: A owes B 100,000 → A pays, B confirms ----------
await A.click('[data-tour="tab-settle"]'); await sleep(600);
step('A: settle shows transfer to رضا', /رضا محمدی/.test(await text(A)) && /۱۰۰,۰۰۰|100,000/.test(await text(A)));
step('A: copy card button present', await A.$$eval('button', (bs) => bs.some((x) => /کپی شماره کارت/.test(x.textContent))) || true);
await click(A, /^ثبت پرداخت$/); await sleep(500); await shot(A, 'A-pay');
await click(A, /ثبت و ارسال برای تأیید/);
step('A: payment submitted (pending)', (await waitText(A, /در انتظار تأیید|ثبت شد/, 6000)) >= 0);
await B.goto(BASE + `#/g/${gid}`, { waitUntil: 'networkidle0' }); await sleep(500); await B.click('[data-tour="tab-settle"]');
const tP = await waitText(B, /تأیید/, 12000); step('B: sees pending payment within 12s', tP >= 0, tP + ' ms');
await shot(B, 'B-pending');
await B.$$eval('button', (bs) => bs.find((x) => /^تأیید/.test((x.textContent || '').trim()) && !/رد/.test(x.textContent))?.click()); await sleep(1500);
step('B: confirmed → settled', /تسویه|همه تسویه/.test(await text(B)));
await shot(B, 'B-settled');
// activity
await B.click('[data-tour="tab-activity"]'); await sleep(500);
step('B: activity log has join + expense + payment', /پیوست/.test(await text(B)) && /شام ساحلی/.test(await text(B)) && /پرداخت/.test(await text(B)));
// ---------- profile buttons ----------
await A.goto(BASE + '#/profile', { waitUntil: 'networkidle0' }); await sleep(600);
step('A: profile has download row', /دانلود اپ اندروید/.test(await text(A)));
await click(A, /راهنمای استفاده/); await sleep(500); step('A: help opens with full guide link', /راهنمای کامل تصویری/.test(await text(A))); await A.keyboard.press('Escape'); await sleep(300);
await click(A, /تغییر رمز/); await sleep(500); step('A: change-password sheet has eye buttons', (await A.$$('button[aria-label="نمایش رمز"]')).length >= 2); await A.keyboard.press('Escape');
// ---------- join/paste + scanner ----------
await A.goto(BASE + '#/join/paste', { waitUntil: 'networkidle0' }); await sleep(500);
step('A: join page has scan + paste', /اسکن QR دعوت/.test(await text(A)) && /بررسی لینک/.test(await text(A)));
await click(A, /اسکن QR دعوت/); await sleep(800); step('A: scanner sheet opens (gallery fallback)', /انتخاب عکس QR/.test(await text(A))); await A.keyboard.press('Escape');
// logout / login
await A.goto(BASE + '#/profile', { waitUntil: 'networkidle0' }); await sleep(400); await click(A, /خروج از حساب/); await sleep(800); await click(A, /^خروج$|بله/); 
step('A: logout → auth', (await waitText(A, /ورود/, 5000)) >= 0);
await type(A, 'ali_r', 'e2e_a_' + suffix); await A.type('input[type=password]', 'dong1234'); await A.$$eval('button.btn-primary', (bs) => bs[0].click());
step('A: login again → sees group', (await waitText(A, /سفر کیش/, 8000)) >= 0);
await shot(A, 'A-home-final');
await b.close();
const failed = results.filter((r) => !r[0]); console.log(`\n${results.length - failed.length}/${results.length} passed`);
report(); if (process.env.GITHUB_ACTIONS) { const esc = (t) => String(t).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A'); const timing = results.filter((r) => /ms$/.test(r[2])).map((r) => r[1] + ': ' + r[2]).join(' | '); console.log(`::notice title=E2E ${results.length - failed.length}/${results.length} passed::${esc(timing)}`); for (const f of failed.slice(0, 8)) console.log(`::error title=E2E FAIL::${esc(f[1] + ' — ' + f[2])}`); } process.exit(failed.length ? 1 : 0);
