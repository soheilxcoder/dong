# راه‌اندازی سرور اختصاصی دُنگ (راهنمای قدم‌به‌قدم برای مبتدی‌ها)

با این راهنما یک سرور شخصی برای دُنگ راه می‌اندازی که:

- **همه‌چیز در یک برنامه است**: وب‌اپ + API + دیتابیس (SQLite، فقط یک فایل). نه PostgreSQL می‌خواهد، نه Redis، نه هیچ سرویس دیگری.
- کاربران با **آدرس سایتِ خودت** وارد اپ می‌شوند، یا در اپ اندروید آدرس سرور را می‌زنند.
- داده‌ها روی سرور خودت می‌ماند و بین همهٔ اعضای گروه **بلافاصله** همگام می‌شود.

> نسخهٔ عمومی روی GitHub Pages (`soheilxcoder.github.io/dong`) همچنان بدون سرور و آفلاین کار می‌کند؛ این راهنما فقط برای کسانی است که سرور خودشان را می‌خواهند.

---

## ۱) چی لازم داری؟

| مورد | حداقل |
|---|---|
| یک سرور لینوکسی (VPS) | ۱ هسته، ۵۱۲MB رم، اوبونتو ۲۲.۰۴ یا جدیدتر |
| یک دامنه (اختیاری ولی توصیه‌شده) | مثلاً `dong.example.com` که به IP سرور اشاره کند |
| Node.js | نسخهٔ **22.13 یا جدیدتر** (به‌خاطر SQLite داخلی Node) |

---

## ۲) روش سریع: Docker (پیشنهادی)

```bash
# روی سرور:
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
git clone https://github.com/soheilxcoder/dong.git
cd dong
cp .env.example .env
nano .env          # JWT_SECRET را با یک رشتهٔ تصادفی بلند عوض کن، PUBLIC_APP_URL را آدرس سایتت بگذار
sudo docker compose up -d --build
```

تمام! سرور روی پورت `4000` بالا است: `http://IP-سرور:4000`

- لاگ‌ها: `sudo docker compose logs -f`
- به‌روزرسانی: `git pull && sudo docker compose up -d --build`
- داده‌ها در volume به نام `dong-data` ذخیره می‌شوند (بخش پشتیبان‌گیری را ببین).

---

## ۳) روش دستی: بدون Docker

```bash
# نصب Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git
node -v     # باید v22.13 یا بالاتر باشد

# دریافت و ساخت
git clone https://github.com/soheilxcoder/dong.git
cd dong
npm ci
npm run build:selfhost

# تنظیمات
cp apps/api/.env.example apps/api/.env
nano apps/api/.env      # JWT_SECRET و PUBLIC_APP_URL را حتماً تغییر بده

# اجرا (تست)
cd apps/api && npm start
```

اگر پیام `dong server listening on http://0.0.0.0:4000` را دیدی، درست است.

### همیشه‌روشن نگه‌داشتن با pm2

```bash
sudo npm i -g pm2
cd ~/dong/apps/api
pm2 start "node --no-warnings dist/server.js" --name dong
pm2 save && pm2 startup     # دستوری که چاپ می‌شود را اجرا کن تا بعد از ری‌استارت سرور هم بالا بیاید
```

به‌روزرسانی نسخهٔ دستی:

```bash
cd ~/dong && git pull && npm ci && npm run build:selfhost && pm2 restart dong
```

---

## ۴) دامنه و HTTPS (nginx + Let's Encrypt)

اپ برای دوربین، PWA و کپی شماره کارت به **HTTPS** نیاز دارد. با nginx جلوی سرور می‌گذاریم:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo nano /etc/nginx/sites-available/dong
```

محتوا:

```nginx
server {
    server_name dong.example.com;
    client_max_body_size 10m;          # عکس رسید
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/dong /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d dong.example.com     # گواهی رایگان + تمدید خودکار
```

حالا `https://dong.example.com` را باز کن؛ باید صفحهٔ ورود دُنگ را ببینی. در `.env` هم `PUBLIC_APP_URL=https://dong.example.com/` بگذار تا لینک‌های دعوت درست ساخته شوند (بعدش سرویس را ری‌استارت کن).

---

## ۵) اتصال اپ اندروید به سرور خودت

دو راه:

1. **بدون ساخت مجدد اپ** (ساده‌ترین): اپ را نصب کن ← **پروفایل ← اتصال به سرور** ← آدرس را وارد کن:
   `https://dong.example.com/api`
   از این به بعد ثبت‌نام/ورود و همهٔ داده‌ها روی سرور تو انجام می‌شود.
2. **اپ اختصاصی که از اول به سرور تو وصل است**: موقع ساخت، متغیر `VITE_API_URL=https://dong.example.com/api` را تنظیم کن (در GitHub Actions به‌عنوان Variable/Secret، یا لوکال قبل از `npm run build`). این اپ دیگر حالت آفلاین/محلی ندارد و مستقیم با سرور کار می‌کند.

---

## ۶) پشتیبان‌گیری (خیلی مهم)

کل داده‌ها فقط **دو چیز** است:

- فایل دیتابیس: `data/dong.db` (در Docker: داخل volume `dong-data`)
- پوشهٔ عکس رسیدها: `data/uploads/`

بک‌آپ روزانه با cron (نسخهٔ دستی):

```bash
crontab -e
# هر شب ساعت ۳:
0 3 * * * tar czf ~/dong-backup-$(date +\%F).tgz -C ~/dong/apps/api data
```

در Docker:

```bash
sudo docker run --rm -v dong_dong-data:/data -v $PWD:/backup alpine tar czf /backup/dong-backup-$(date +%F).tgz -C /data .
```

برای بازگردانی، فقط همان فایل‌ها را سر جایشان بگذار و سرویس را ری‌استارت کن.

---

## ۷) یادآوری‌های خودکار (Push) — اختیاری

سرور هر روز ساعت ۱۰ صبح به بدهکاران نوتیفیکیشن مرورگری می‌فرستد، به شرطی که کلیدهای VAPID را تنظیم کرده باشی:

```bash
npx web-push generate-vapid-keys
```

خروجی را در `.env` بگذار (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:you@example.com`) و ری‌استارت کن. بدون این کلیدها سرور بدون خطا کار می‌کند، فقط Push ندارد.

---

## ۸) رفع اشکال

| مشکل | راه‌حل |
|---|---|
| `SyntaxError: ... node:sqlite` یا `Cannot find module 'node:sqlite'` | Node قدیمی است؛ `node -v` باید ≥ 22.13 باشد. |
| وب‌اپ باز می‌شود ولی «سرور در دسترس نیست» | `curl http://127.0.0.1:4000/api/health` باید `{"ok":true}` بدهد؛ لاگ pm2/docker را ببین. |
| لینک دعوت به آدرس اشتباه اشاره می‌کند | `PUBLIC_APP_URL` را درست کن و ری‌استارت. |
| آپلود رسید خطای 413 می‌دهد | `client_max_body_size 10m;` را در nginx اضافه کن. |
| بعد از به‌روزرسانی داده‌ها نیستند | `DATABASE_FILE`/`UPLOAD_DIR` را عوض نکرده باشی؛ داده‌ها در `apps/api/data` (یا volume) هستند. |

مسیرهای مفید: `GET /api/health` (سلامت)، `GET /api/uploads/...` (عکس‌ها).

---

## ۹) متغیرهای محیطی (خلاصه)

| متغیر | پیش‌فرض | توضیح |
|---|---|---|
| `PORT` | 4000 | پورت سرور |
| `JWT_SECRET` | — | **الزامی**؛ رشتهٔ تصادفی بلند |
| `DATABASE_FILE` | ./data/dong.db | فایل SQLite |
| `UPLOAD_DIR` | ./data/uploads | عکس رسیدها |
| `PUBLIC_APP_URL` | — | آدرس عمومی اپ برای لینک دعوت/QR |
| `CORS_ORIGIN` | * | اگر وب‌اپ از دامنهٔ دیگری سرو می‌شود، آن را بنویس |
| `WEB_DIR` | خودکار | پوشهٔ وب‌اپ ساخته‌شده |
| `VAPID_*` | خالی | Web Push |
