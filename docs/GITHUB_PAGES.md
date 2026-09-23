# راه‌اندازی GitHub Pages برای دُنگ

همه‌چیز آماده است؛ فقط یک کلیک لازم دارد.

## ۱. فعال‌سازی (یک‌بار)
1. در گیت‌هاب: **Settings → Pages**
2. بخش **Build and deployment → Source** را روی **GitHub Actions** بگذارید.
3. تمام. با هر push به `main`، ورک‌فلوی `.github/workflows/pages.yml` اجرا می‌شود و اپ روی
   **https://soheilxcoder.github.io/dong/** منتشر می‌شود.

> برای اولین بار می‌توانید از تب **Actions → Deploy to GitHub Pages → Run workflow** هم دستی اجرا کنید.

## ۲. چه اتفاقی می‌افتد؟
- `npm ci` → `npm test` (تست‌های موتور محاسباتی) → `npm run build` با `VITE_BASE=/dong/`
- `404.html` = کپی `index.html` (تا رفرش صفحات و لینک‌های دعوت `#/join/…` نشکند)
- `.nojekyll` اضافه می‌شود تا فایل‌های با `_` نادیده گرفته نشوند
- آرتیفکت با `actions/deploy-pages` منتشر می‌شود

## ۳. نکات
- اپ **PWA** است: در Chrome اندروید «Add to Home screen» می‌دهد و آفلاین کار می‌کند.
- روتینگ با `HashRouter` است تا روی Pages بدون سرور کار کند.
- اگر نام ریپو را تغییر دادید، چیزی لازم نیست عوض کنید؛ `base` از نام ریپو خوانده می‌شود.
- دامنه شخصی: در Settings → Pages → Custom domain تنظیم کنید و در `pages.yml` مقدار `VITE_BASE` را `/` بگذارید.
