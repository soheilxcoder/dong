// Builds the illustrated user guide from tools/docs/guide.json:
//   apps/web/public/guide/index.html  (served at <site>/guide/)
//   docs-src/USER_GUIDE.md            (repo documentation)
import fs from 'fs'; import path from 'path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const chapters = JSON.parse(fs.readFileSync(path.join(root, 'tools/docs/guide.json'), 'utf8'));
const SITE = 'https://products.arounidea.com/dong/';
const faq = [
  ['اپ پول جابه‌جا می‌کند؟', 'نه. دُنگ فقط حساب‌کتاب می‌کند و می‌گوید چه‌کسی به چه‌کسی چقدر بدهد. پرداخت را خودتان کارت‌به‌کارت می‌کنید و در اپ «ثبت پرداخت» می‌زنید.'],
  ['اگر اینترنت نداشته باشم؟', 'همه‌چیز آفلاین کار می‌کند و روی گوشی ذخیره می‌شود؛ به محض وصل شدن، با اعضای گروه همگام می‌شود.'],
  ['چرا جمع سهم‌ها با مبلغ کل ۱ تومان فرق دارد؟', 'فرق ندارد؛ باقی‌ماندهٔ تقسیم (مثلاً ۱۰۰٬۰۰۱ تقسیم بر ۳) خودکار به پرداخت‌کننده اضافه می‌شود تا جمع دقیقاً برابر کل باشد.'],
  ['شماره کارتم را همه می‌بینند؟', 'فقط اعضای گروه‌هایی که در آن‌ها هستی، و فقط وقتی به تو بدهکار باشند برایشان نمایش داده می‌شود.'],
  ['چطور اپ را به‌روز کنم؟', 'در اپ: پروفایل ← «بررسی نسخه جدید». در وب: پروفایل ← «دانلود اپ اندروید» همیشه آخرین نسخه را می‌دهد. صفحهٔ دانلود: ' + SITE + 'apk/'],
  ['حسابم را حذف کنم چه می‌شود؟', 'از پروفایل خارج شو؛ داده‌های محلی پاک می‌شوند. هزینه‌هایی که در گروه‌ها ثبت کرده‌ای برای شفافیت گروه باقی می‌مانند.'],
];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
// ---------- HTML ----------
let h = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>راهنمای کامل دُنگ</title><meta name="description" content="راهنمای تصویری و قدم‌به‌قدم اپلیکیشن دُنگ — تقسیم هزینه گروهی">
<link rel="icon" href="../icons/icon-180.png">
<style>
:root{--bg:#f7f9fa;--card:#fff;--ink:#1e1b18;--ink2:#6b6560;--brand:#0fb88a;--brand2:#0891b2;--line:#e8ecef}
@media(prefers-color-scheme:dark){:root{--bg:#0f1418;--card:#171d22;--ink:#f2f4f5;--ink2:#9aa3ab;--line:#232b31}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Vazirmatn,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.9}
@font-face{font-family:Vazirmatn;src:url(Vazirmatn.woff2) format("woff2");font-weight:100 900;font-display:swap}
header{background:linear-gradient(135deg,var(--brand),var(--brand2));color:#fff;padding:40px 20px 56px;text-align:center}
header h1{margin:0 0 6px;font-size:30px}header p{margin:0;opacity:.92}
.wrap{max-width:1040px;margin:-28px auto 60px;padding:0 16px}
nav.toc{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:16px 20px;display:flex;flex-wrap:wrap;gap:8px;box-shadow:0 10px 30px rgba(0,0,0,.06)}
nav.toc a{text-decoration:none;color:var(--ink);background:var(--bg);border-radius:999px;padding:6px 14px;font-weight:700;font-size:14px}
h2{margin:44px 0 12px;font-size:24px;display:flex;align-items:center;gap:10px}
.sec{display:grid;grid-template-columns:1fr 250px;gap:24px;align-items:start;background:var(--card);border:1px solid var(--line);border-radius:22px;padding:22px;margin:14px 0}
.sec h3{margin:0 0 8px;font-size:19px}.sec p{margin:0;color:var(--ink)}.sec ul{margin:10px 0 0;padding:0 18px 0 0;color:var(--ink2)}
.sec img{width:100%;border-radius:18px;border:1px solid var(--line);box-shadow:0 12px 32px rgba(0,0,0,.12)}
@media(max-width:720px){.sec{grid-template-columns:1fr}.sec img{max-width:320px;margin:0 auto;display:block}}
details{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px 18px;margin:8px 0}summary{font-weight:800;cursor:pointer}
.cta{display:inline-block;background:linear-gradient(135deg,var(--brand),var(--brand2));color:#fff;text-decoration:none;font-weight:800;padding:12px 24px;border-radius:14px;margin-top:8px}
footer{text-align:center;color:var(--ink2);font-size:13px;padding:30px}
</style></head><body>
<header><h1>راهنمای کامل دُنگ</h1><p>تقسیم هزینهٔ گروهی، قدم‌به‌قدم و با تصویر</p></header>
<div class="wrap">
<nav class="toc">${chapters.map((c) => `<a href="#${c.id}">${c.icon} ${c.title}</a>`).join('')}<a href="#faq">❓ سؤال‌های رایج</a><a href="#install">📲 نصب</a></nav>
`;
for (const c of chapters) {
  h += `<h2 id="${c.id}">${c.icon} ${esc(c.title)}</h2>`;
  for (const s of c.sections) h += `<section class="sec"><div><h3>${esc(s.h)}</h3><p>${esc(s.p)}</p>${s.tips ? `<ul>${s.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}</div><img loading="lazy" src="img/${s.img}.jpg" alt="${esc(s.h)}"></section>`;
}
h += `<h2 id="faq">❓ سؤال‌های رایج</h2>${faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}
<h2 id="install">📲 نصب</h2><section class="sec"><div><h3>اندروید</h3><p>آخرین نسخه را از صفحهٔ دانلود بگیر و نصب کن (اگر گوشی پرسید، «نصب از منابع ناشناس» را برای مرورگر اجازه بده). به‌روزرسانی‌ها از داخل خودِ اپ اطلاع داده می‌شوند.</p><a class="cta" href="../apk/">دانلود اپ اندروید</a><h3 style="margin-top:22px">وب / آیفون</h3><p>آدرس <a href="${SITE}">${SITE}</a> را باز کن و از منوی مرورگر «Add to Home Screen» را بزن؛ دُنگ مثل یک اپ نصب می‌شود و آفلاین هم کار می‌کند.</p></div><img loading="lazy" src="img/04-home.jpg" alt="نصب"></section>
</div><footer>دُنگ · <a href="../privacy.html" style="color:inherit">سیاست حریم خصوصی</a> · <a href="../" style="color:inherit">بازگشت به اپ</a></footer></body></html>`;
fs.mkdirSync(path.join(root, 'apps/web/public/guide'), { recursive: true });
fs.writeFileSync(path.join(root, 'apps/web/public/guide/index.html'), h);
// ---------- Markdown ----------
let m = `# راهنمای کامل کاربر — دُنگ\n\n> نسخهٔ آنلاین همین راهنما: ${SITE}guide/ · تصاویر با \`npm run shots:docs\` از خودِ اپ گرفته می‌شوند و با \`node tools/docs/build-guide.mjs\` این فایل و صفحهٔ وب دوباره ساخته می‌شوند.\n\n## فهرست\n${chapters.map((c) => `- [${c.icon} ${c.title}](#${c.id})`).join('\n')}\n- [❓ سؤال‌های رایج](#faq)\n`;
for (const c of chapters) {
  m += `\n<a id="${c.id}"></a>\n## ${c.icon} ${c.title}\n`;
  for (const s of c.sections) m += `\n### ${s.h}\n<img src="../apps/web/public/guide/img/${s.img}.jpg" width="260" align="left" />\n\n${s.p}\n${s.tips ? '\n' + s.tips.map((t) => `- ${t}`).join('\n') + '\n' : ''}\n<br clear="all"/>\n`;
}
m += `\n<a id="faq"></a>\n## ❓ سؤال‌های رایج\n${faq.map(([q, a]) => `\n**${q}**  \n${a}\n`).join('')}\n`;
fs.writeFileSync(path.join(root, 'docs-src/USER_GUIDE.md'), m);
console.log('guide built');
