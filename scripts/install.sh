#!/usr/bin/env bash
# ============================================================================
#  دُنگ — نصب تک‌دستوری سرور اختصاصی (Ubuntu 22.04/24.04 یا Debian 12)
#
#  روی سرور تازه، به‌عنوان root:
#     curl -fsSL https://raw.githubusercontent.com/soheilxcoder/dong/main/scripts/install.sh | bash
#
#  کارهایی که خودش انجام می‌دهد:
#   Node 22 + nginx + certbot نصب می‌کند، کد را در /opt/dong می‌گیرد و می‌سازد،
#   .env با JWT_SECRET تصادفی می‌نویسد، سرویس systemd می‌سازد (همیشه‌روشن)،
#   دامنه + HTTPS رایگان، بک‌آپ شبانه، و دستورهای  dong-update / dong-backup / dong-firebase
# ============================================================================
set -euo pipefail

REPO="${DONG_REPO:-https://github.com/soheilxcoder/dong.git}"
BRANCH="${DONG_BRANCH:-main}"
DIR=/opt/dong
DATA=/var/lib/dong
ENV_FILE=/etc/dong.env

c() { printf '\033[1;36m%s\033[0m\n' "$*"; }
ok() { printf '\033[1;32m✔ %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m✘ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "این اسکریپت را با root اجرا کن (sudo -i سپس دوباره اجرا)."
command -v apt-get >/dev/null || die "فقط Ubuntu/Debian پشتیبانی می‌شود."

# read answers from the terminal even when piped through `curl | bash`
exec 3</dev/tty || exec 3<&0
ask() { local q="$1" d="${2:-}" a; printf '\033[1;33m%s\033[0m %s' "$q" "${d:+[$d] }" >&2; read -r a <&3 || true; printf '%s' "${a:-$d}"; }

c "──────────── دُنگ: نصب سرور اختصاصی ────────────"
DOMAIN="${DONG_DOMAIN:-$(ask 'دامنه‌ات چیست؟ (مثلاً dong.example.com — اگر دامنه نداری خالی بگذار تا با IP کار کند)' '')}"
EMAIL=""
if [ -n "$DOMAIN" ]; then
  EMAIL="${DONG_EMAIL:-$(ask 'ایمیل برای گواهی HTTPS (Let'"'"'s Encrypt):' 'admin@'"$DOMAIN")}"
fi

# ---------- packages ----------
c "۱/۶ نصب پیش‌نیازها…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git ca-certificates gnupg nginx ufw >/dev/null
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".").map(Number).reduce((a,b,i)=>a+b*[10000,100,1][i],0)')" -lt 221300 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
ok "Node $(node -v)"

# ---------- code ----------
c "۲/۶ دریافت و ساخت برنامه (۲–۴ دقیقه)…"
if [ -d "$DIR/.git" ]; then git -C "$DIR" fetch -q origin && git -C "$DIR" checkout -q "$BRANCH" && git -C "$DIR" pull -q; else git clone -q -b "$BRANCH" "$REPO" "$DIR"; fi
cd "$DIR"
npm ci --no-audit --no-fund --loglevel=error
npm run build:selfhost --silent
ok "ساخته شد"

# ---------- data + env ----------
c "۳/۶ تنظیمات…"
id -u dong >/dev/null 2>&1 || useradd -r -s /usr/sbin/nologin -d "$DATA" dong
mkdir -p "$DATA/uploads"; chown -R dong:dong "$DATA"
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<EOF
PORT=4000
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
DATABASE_FILE=$DATA/dong.db
UPLOAD_DIR=$DATA/uploads
PUBLIC_APP_URL=${DOMAIN:+https://$DOMAIN/}
CORS_ORIGIN=*
# نوتیفیکیشن اپ اندروید: با دستور  dong-firebase /path/to/service-account.json  پر می‌شود
FIREBASE_SERVICE_ACCOUNT=
# نوتیفیکیشن مرورگر (اختیاری): npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:${EMAIL:-admin@example.com}
EOF
  chmod 600 "$ENV_FILE"
fi
[ -z "$DOMAIN" ] && sed -i "s|^PUBLIC_APP_URL=.*|PUBLIC_APP_URL=http://$(curl -fsS4 ifconfig.me || hostname -I | awk '{print $1}')/|" "$ENV_FILE"
ok "$ENV_FILE"

# ---------- systemd ----------
c "۴/۶ سرویس همیشه‌روشن…"
cat > /etc/systemd/system/dong.service <<EOF
[Unit]
Description=Dong (دُنگ) server
After=network.target

[Service]
User=dong
WorkingDirectory=$DIR
EnvironmentFile=$ENV_FILE
ExecStart=$(command -v node) --no-warnings $DIR/apps/api/dist/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
chown -R dong:dong "$DIR/apps/api/web" "$DIR/apps/api/dist"
systemctl daemon-reload
systemctl enable -q --now dong
systemctl restart dong
sleep 2
curl -fsS http://127.0.0.1:4000/api/health >/dev/null || { journalctl -u dong -n 30 --no-pager; die "سرویس بالا نیامد (لاگ بالا)"; }
ok "سرویس dong در حال اجراست"

# ---------- nginx + https ----------
c "۵/۶ وب‌سرور و HTTPS…"
cat > /etc/nginx/sites-available/dong <<EOF
server {
    listen 80;
    server_name ${DOMAIN:-_};
    client_max_body_size 10m;
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF
ln -sf /etc/nginx/sites-available/dong /etc/nginx/sites-enabled/dong
rm -f /etc/nginx/sites-enabled/default
nginx -t -q && systemctl reload nginx
ufw allow OpenSSH >/dev/null 2>&1 || true; ufw allow 'Nginx Full' >/dev/null 2>&1 || true
if [ -n "$DOMAIN" ]; then
  apt-get install -y -qq certbot python3-certbot-nginx >/dev/null
  if certbot --nginx -d "$DOMAIN" -m "$EMAIL" --agree-tos --non-interactive --redirect; then ok "HTTPS فعال شد"
  else echo "⚠ گواهی HTTPS گرفته نشد — مطمئن شو رکورد A دامنه به IP این سرور اشاره می‌کند و بعداً اجرا کن:  certbot --nginx -d $DOMAIN"; fi
fi

# ---------- helper commands + backup ----------
c "۶/۶ دستورهای کمکی و بک‌آپ شبانه…"
cat > /usr/local/bin/dong-update <<EOF
#!/usr/bin/env bash
set -e; cd $DIR; git pull -q; npm ci --no-audit --no-fund --loglevel=error; npm run build:selfhost --silent
chown -R dong:dong apps/api/web apps/api/dist; systemctl restart dong; sleep 2; curl -fsS http://127.0.0.1:4000/api/health && echo " ✔ به‌روزرسانی شد"
EOF
cat > /usr/local/bin/dong-backup <<EOF
#!/usr/bin/env bash
set -e; mkdir -p /root/dong-backups; f=/root/dong-backups/dong-\$(date +%F-%H%M).tgz
tar czf "\$f" -C $DATA . ; ls -t /root/dong-backups/*.tgz | tail -n +15 | xargs -r rm -f; echo "✔ \$f"
EOF
cat > /usr/local/bin/dong-firebase <<EOF
#!/usr/bin/env bash
# فعال‌کردن نوتیفیکیشن اپ اندروید:  dong-firebase /root/service-account.json
set -e; [ -f "\$1" ] || { echo "فایل پیدا نشد: \$1"; exit 1; }
install -o dong -g dong -m 600 "\$1" $DATA/firebase-service-account.json
sed -i "s|^FIREBASE_SERVICE_ACCOUNT=.*|FIREBASE_SERVICE_ACCOUNT=$DATA/firebase-service-account.json|" $ENV_FILE
systemctl restart dong; sleep 2; journalctl -u dong -n 5 --no-pager | grep -q "FCM push enabled" && echo "✔ نوتیفیکیشن اندروید فعال شد" || { echo "✘ فعال نشد — لاگ:"; journalctl -u dong -n 20 --no-pager; }
EOF
chmod +x /usr/local/bin/dong-update /usr/local/bin/dong-backup /usr/local/bin/dong-firebase
( crontab -l 2>/dev/null | grep -v dong-backup; echo "0 3 * * * /usr/local/bin/dong-backup >/dev/null 2>&1" ) | crontab -

URL="${DOMAIN:+https://$DOMAIN/}"; [ -z "$URL" ] && URL="$(grep ^PUBLIC_APP_URL "$ENV_FILE" | cut -d= -f2)"
echo
c "════════════════════════════════════════════"
ok "دُنگ نصب شد!  آدرس:  $URL"
echo "   • اپ اندروید: پروفایل ← اتصال به سرور ←  ${URL}api"
echo "   • نوتیفیکیشن اندروید:  dong-firebase /root/service-account.json   (فایل را از Firebase بگیر — راهنما: docs-src/SETUP_CLICK_BY_CLICK.md)"
echo "   • به‌روزرسانی:  dong-update      • بک‌آپ دستی:  dong-backup   (شبانه ۳:۰۰ خودکار در /root/dong-backups)"
echo "   • لاگ:  journalctl -u dong -f    • تنظیمات:  $ENV_FILE"
c "════════════════════════════════════════════"
