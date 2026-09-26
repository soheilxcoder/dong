# استقرار دُنگ روی هاست Plesk (products.arounidea.com/dong)

اپ به‌صورت **استاتیک** روی هاست سرو می‌شود (نیازی به Node روی هاست نیست). GitHub Actions بعد از هر تغییر، خروجی ساخته‌شده را در پوشهٔ `deploy/dong/` همین شاخه commit می‌کند و Plesk فقط آن را pull می‌کند. فایل `.htaccess` ریشهٔ ریپو، آدرس `/dong/*` را به `deploy/dong/*` نگاشت می‌کند و سورس‌ها را مخفی می‌کند.

## Plesk → دامنهٔ products.arounidea.com → Git → Create repository
| فیلد | مقدار |
|---|---|
| Code location | **Remote repository** |
| Repository URL | `https://github.com/soheilxcoder/dong.git` |
| Repository name | `dong` |
| Deployment mode | **Automatic** |
| Server path | `/httpdocs/dong` |
| Additional deployment actions | خالی |

بعد از ساخت: در تنظیمات مخزن (Repository settings) **Branch** را روی `arena/01a0cbee-dong` بگذار و «Pull now / Deploy» بزن. Webhook URL نمایش‌داده‌شده را در GitHub → Settings → Webhooks → Add webhook (Content type: application/json, فقط push) اضافه کن تا خودکار به‌روز شود.

## اگر صفحه سفید/۴۰۴ بود
Plesk → همان دامنه → **Apache & nginx Settings** → تیک **«Serve static files directly by nginx»** را بردار → OK. (در غیر این صورت nginx فایل‌های js/css را قبل از رسیدن به قانون بازنویسی Apache ۴۰۴ می‌کند.)

## بررسی
- `https://products.arounidea.com/dong/` → اپ باز شود
- `https://products.arounidea.com/dong/BUILD.txt` → شناسهٔ آخرین build
- `https://products.arounidea.com/dong/package.json` → باید 404 باشد (سورس مخفی است)

## محصولات بعدی
برای هر محصول جدید همین الگو: مخزن جدا، Server path `/httpdocs/<name>`، و `.htaccess` مشابه با `RewriteBase /<name>/`.

## سرور اختصاصی (API با PHP + SQLite)

اپ از این نسخه به‌صورت پیش‌فرض به `https://products.arounidea.com/dong/api` وصل می‌شود. این API یک فایل PHP است (`api/index.php`) که با همان Git deploy کنار سایت مستقر می‌شود و به هیچ Node/دیتابیس جدایی نیاز ندارد.

### تنظیمات یک‌بارهٔ Plesk (products.arounidea.com)
1. **Websites & Domains → products.arounidea.com → PHP Settings**: نسخهٔ PHP را **8.1 یا بالاتر** انتخاب کن (8.2/8.3 بهتر). حالت اجرا: FPM application served by Apache (یا nginx) — هر کدام بود اشکالی ندارد.
2. در همان صفحه در بخش Extensions مطمئن شو **pdo_sqlite** و **sqlite3** و **fileinfo** و **mbstring** تیک دارند. (معمولاً پیش‌فرض روشن‌اند.)
3. **Apache & nginx Settings**: گزینهٔ «Serve static files directly by nginx» را **خاموش** کن یا حداقل پسوند `php` را در آن نگذار؛ همچنین «Proxy mode» روشن بماند تا `.htaccess` اعمال شود.
4. بعد از deploy، آدرس `https://products.arounidea.com/dong/api/` را باز کن؛ باید `{"ok":true,"name":"dong-api","engine":"php",...}` ببینی.
5. داده‌ها (SQLite + عکس‌ها) در پوشهٔ `dong-data` **کنار** `httpdocs` ساخته می‌شوند (خارج از وب‌روت، پس با هر deploy پاک نمی‌شوند). اگر آنجا قابل نوشتن نبود، به‌صورت خودکار از `dong/api/data` استفاده می‌شود. برای بکاپ همین پوشه را دانلود کن.

### عیب‌یابی
- خطای 500 با پیام «SQLite در دسترس نیست» → افزونهٔ pdo_sqlite خاموش است (مرحلهٔ ۲).
- 404 برای `/dong/api/users/me` → `.htaccess` اعمال نمی‌شود (مرحلهٔ ۳) یا نسخهٔ PHP قدیمی است.
- اپ می‌گوید «ابتدا وارد شوید» بعد از ورود → هدر Authorization به PHP نمی‌رسد؛ در PHP Settings حالت را روی «FPM application served by Apache» بگذار.
