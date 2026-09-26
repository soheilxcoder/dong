# همگام‌سازی زنده (WebSocket) — راه‌اندازی رایگان روی Cloudflare

اپ برای «در لحظه» بودن از یک هاب WebSocket کوچک استفاده می‌کند (`rt/`): یک Cloudflare Worker + Durable Object.
هیچ دادهٔ مالی از آن رد نمی‌شود؛ فقط سیگنال «گروه X عوض شد» بین اعضای همان گروه پخش می‌شود و اپ از سرور PHP خودت داده را می‌گیرد.
پلن **Free** کلودفلر کافی است (۱۰۰ هزار درخواست در روز، ۳۲ هزار اتصال هم‌زمان روی یک آبجکت).
اگر هاب در دسترس نباشد، اپ خودکار به حالت polling هر ۲٫۵ ثانیه برمی‌گردد؛ یعنی هیچ‌وقت چیزی گم نمی‌شود.

## یک‌بار برای همیشه (۱۰ دقیقه)

### ۱) حساب Cloudflare
1. برو به https://dash.cloudflare.com/sign-up و با ایمیل ثبت‌نام کن (رایگان، کارت نمی‌خواهد).
2. بعد از ورود، منوی چپ → **Workers & Pages** → دکمهٔ **Get started / Set up** را بزن. یک **subdomain** برای workers.dev از تو می‌پرسد (مثلاً `arounidea`). همین را وارد کن → آدرس هاب می‌شود:
   `wss://dong-rt.arounidea.workers.dev`  (به‌جای `arounidea` همان چیزی که انتخاب کردی)

### ۲) دو مقدار برای GitHub
1. **Account ID**: در داشبورد کلودفلر، Workers & Pages → سمت راست، بخش «Account details» → **Account ID** (کپی کن).
2. **API Token**: بالا-راست روی آیکون پروفایل → **My Profile → API Tokens → Create Token** → قالب **«Edit Cloudflare Workers»** → **Continue to summary → Create Token** → مقدار را کپی کن (فقط یک‌بار نشان داده می‌شود).

### ۳) در GitHub (ریپوی dong → Settings → Secrets and variables → Actions)
- تب **Secrets** → New repository secret:
  - `CLOUDFLARE_API_TOKEN` = توکن مرحلهٔ ۲
  - `CLOUDFLARE_ACCOUNT_ID` = Account ID
- تب **Variables** → New repository variable:
  - `RT_URL` = `wss://dong-rt.<subdomain>.workers.dev`

### ۴) اولین استقرار
GitHub → تب **Actions** → «Deploy realtime hub (Cloudflare Worker)» → **Run workflow** (برنچ `arena/01a0cbee-dong`).
سبز که شد، `https://dong-rt.<subdomain>.workers.dev/health` باید `{"ok":true,"name":"dong-rt"}` بدهد.
از این به بعد هر تغییری در `rt/` خودکار deploy می‌شود.

### ۵) بیلد دوباره
Actions → «Android APK» → Run workflow، و «Build static sites…» → Run workflow (یا یک پوش جدید). چون `RT_URL` حالا وجود دارد، اپ و وب با آدرس هاب ساخته می‌شوند.
داخل هر گروه، بالای صفحه به‌جای «همگام» باید **«زنده»** ببینی.

## دامنهٔ اختصاصی (اختیاری)
اگر `arounidea.com` روی کلودفلر باشد، در Workers & Pages → dong-rt → Settings → Domains & Routes → **Add → Custom domain** → `rt.arounidea.com`؛ بعد `RT_URL` را به `wss://rt.arounidea.com` تغییر بده و دوباره بیلد کن. (برای کاربران ایرانی گاهی دامنهٔ اختصاصی پایدارتر از workers.dev است.)

## تست محلی
```bash
cd rt && npm i && npm run dev          # http://127.0.0.1:8787
RT_URL=ws://127.0.0.1:8787 node test.mjs  # سه کلاینت، بررسی fan-out و ایزوله بودن گروه‌ها
```
