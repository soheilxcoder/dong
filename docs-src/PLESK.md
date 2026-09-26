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
