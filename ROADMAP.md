# 🗺️ نقشه راه کامل ساخت اپلیکیشن «دُنگ» (Dong)

> این سند، برنامه اجرایی دقیق برای تبدیل دو سند «فنی» و «طراحی بصری» به یک محصول واقعی، قابل ارائه، قابل انتشار در **Google Play** و قابل مشاهده در **GitHub Pages** است.
> نام صحیح برند: **دُنگ / Dong** (در اسناد قبلی به اشتباه «دُنگ/Dong» نوشته شده بود — همه‌جا اصلاح می‌شود).

---

## ۰. تصمیم‌های معماری کلیدی (چرا این‌طور می‌سازیم)

| چالش | تصمیم | دلیل |
|---|---|---|
| GitHub Pages فقط استاتیک است (سرور و دیتابیس ندارد) | اپ به‌صورت **Offline-First PWA** ساخته می‌شود: تمام منطق، موتور محاسبات و داده‌ها ابتدا روی دستگاه (IndexedDB) کار می‌کنند. | همین نسخه کاملاً کارا در Pages نمایش داده می‌شود و در Play Store بدون سرور هم قابل استفاده است (بدون هزینه هاست). |
| نیاز به گروه چندنفره واقعی (دعوت با لینک/QR، تأیید پرداخت توسط طلبکار) | یک **Backend مستقل** (Node.js + Express + Prisma + PostgreSQL) در همان ریپو (`apps/api`) طبق سند فنی ساخته می‌شود. فرانت با یک «Adapter» کار می‌کند: `LocalAdapter` (بدون سرور) و `ApiAdapter` (با سرور). | هر زمان سرور را روی Railway/Render/Liara/… بالا بیاورید، فقط یک آدرس در تنظیمات اپ وارد می‌شود و حالت گروهی آنلاین فعال می‌شود. تا آن زمان اپ در حالت «محلی» کامل کار می‌کند. |
| انتشار در Play Store | **Capacitor (Android)** روی همان PWA | خروجی AAB امضاشده، دسترسی به Haptics، دوربین، Share Sheet و Splash بومی. یک کدبیس برای وب و اندروید. |
| Path در GitHub Pages (`/dong/`) | `base: '/dong/'` در Vite + HashRouter یا fallback 404.html | لینک‌های دعوت و رفرش صفحات در Pages نمی‌شکند. |
| اعداد مالی | همه مبالغ `integer` (تومان بدون اعشار) — هرگز float | مطابق الزام سند فنی؛ باقیمانده تقسیم به نفر اول لیست. |

---

## ۱. ساختار نهایی ریپو (Monorepo با pnpm)

```
dong/
├── apps/
│   ├── web/                # PWA (React 18 + Vite + TypeScript + Tailwind + Framer Motion)
│   │   ├── public/         # manifest, icons, splash, og-image
│   │   ├── src/
│   │   │   ├── app/        # router, providers, layouts
│   │   │   ├── design-system/  # tokens, components (Button, Card, Avatar, Sheet, Toast…)
│   │   │   ├── features/   # auth, groups, expenses, settlements, profile, activity, reminders
│   │   │   ├── data/       # adapters: local (Dexie/IndexedDB) | api (fetch) — یک اینترفیس مشترک
│   │   │   ├── mascot/     # مسکات SVG با حالت‌ها (idle, happy, confused, waiting)
│   │   │   └── i18n/       # فارسی (RTL) پیش‌فرض + ساختار آماده انگلیسی
│   │   └── android/        # Capacitor project (خروجی Play Store)
│   └── api/                # Express + Prisma + PostgreSQL (طبق بخش ۹ سند فنی)
├── packages/
│   ├── core/               # ⭐ موتور بدهی (Debt Engine) خالص و مستقل + تست‌ها — مشترک بین web و api
│   └── shared-types/       # تایپ‌های مشترک (User, Group, Expense, Settlement…)
├── design/                 # منابع برند: لوگو (SVG/PNG)، آیکون‌های Play (512, adaptive)، فیچر گرافیک 1024×500، اسکرین‌شات‌ها
├── .github/workflows/
│   ├── ci.yml              # lint + typecheck + test روی هر push
│   ├── pages.yml           # build و deploy خودکار apps/web به GitHub Pages
│   └── android.yml         # build دیباگ APK روی هر تگ (اختیاری)
├── docs/                   # اسناد فعلی (منتقل‌شده) + راهنمای انتشار Play Store
└── README.md               # فارسی + انگلیسی، با اسکرین‌شات و لینک دموی Pages
```

---

## ۲. فازهای اجرا (به ترتیب انجام)

### فاز ۱ — پایه پروژه و موتور محاسباتی (بنیان)
- [ ] راه‌اندازی monorepo (pnpm workspaces)، ESLint، Prettier، TypeScript strict، Vitest
- [ ] `packages/core`:
  - `computeNetBalances(expenses, confirmedSettlements)` — بخش ۴.۱
  - `simplifyDebts(balances)` — الگوریتم Greedy بخش ۴.۲ با Max-Heap (کمینه تراکنش)
  - `splitEqual / splitCustom / splitByPayer` با مدیریت باقیمانده
  - `formatToman`, `toPersianDigits`, `formatCardNumber`
- [ ] **۶ تست الزامی سند** + تست تصادفی (property-based) روی بقای مجموع صفر و برابری طلب/بدهی
  - مثال «سفر کیش» (علی/رضا/حسین/محمد) → دقیقاً ۳ تراکنش با مبالغ ۷۵,۰۰۰ / ۷۵,۰۰۰ / ۲۵,۰۰۰

### فاز ۲ — هویت بصری و دیزاین‌سیستم
- [ ] **لوگو و آیکون اپ**: طراحی با ابزار تولید تصویر + بازسازی تمیز به‌صورت SVG (ایده: دایره‌ای که به «سهم‌های» مساوی تقسیم شده و از شکل حرف «د» و نقطه ضمه‌مانند الهام گرفته — قابل خواندن در ۴۸px)
  - خروجی‌ها: `icon-512.png`، Adaptive Icon (foreground/background/monochrome برای Android 13+)، `maskable`، favicon، `apple-touch-icon`، Feature Graphic 1024×500
- [ ] **توکن‌های طراحی** (CSS Variables + Tailwind): پالت روشن/تاریک سند، سه گرادینت امضادار، شعاع‌ها (20/16/999)، spacing 4px، سایه‌های نرم
- [ ] فونت **Vazirmatn** (Variable) به‌صورت self-host با `font-display: swap`، `tabular-nums` برای اعداد
- [ ] **ارتقای طراحی بر پایه ریسرچ ۲۰۲۶** (فراتر از سند):
  - Dark-first (تم تاریک به‌عنوان تم اصلی طراحی، روشن مشتق‌شده) + سوئیچ خودکار با سیستم
  - سطوح Elevation لایه‌ای در دارک (نه سیاه مطلق) + بافت نویز ظریف روی گرادینت‌ها
  - Glass فقط روی Bottom Nav، کارت بالانس و Bottom Sheetها (Responsible Glassmorphism)
  - Bento Grid داینامیک در خانه (کارت گروه با بدهی فوری = بزرگ‌تر)
  - تایپوگرافی جسورانه: بالانس کل با Vazirmatn Black 40px + Count-up انیمیشن
  - ناوبری Gesture-friendly: Bottom Sheetهای قابل‌کشیدن، Swipe برای بستن، FAB بزرگ
  - `prefers-reduced-motion` رعایت می‌شود
- [ ] کامپوننت‌ها: Button (primary/ghost/danger + حالت loading)، Card، GlassCard، Avatar (رنگی هندسی از حروف اول)، AvatarStack، AmountText (Count-up)، Input (با shake خطا)، BottomSheet، Toast، Tabs (با اندیکاتور اسلایدی)، Skeleton، EmptyState (با مسکات)، Confetti (۸–۱۰ ذره)، BankCard (کارت بانکی واقع‌نما)
- [ ] **مسکات دُنگ**: شخصیت مینیمال هندسی SVG با ۴ حالت (منتظر، خوشحال، گیج، در حال چرخش برای Pull-to-refresh)

### فاز ۳ — صفحات و جریان‌های کاربری (فرانت‌اند، حالت محلی)
- [ ] Splash (بومی + وب) و آنبوردینگ ۳ صفحه‌ای با ایلوستریشن هندسی + دکمه «رد کردن»
- [ ] ورود / ثبت‌نام (نام، نام‌کاربری، رمز، سؤال امنیتی، شماره کارت اختیاری) + بازیابی رمز با سؤال امنیتی
- [ ] **خانه**: هدر گرادینت با گوشه منحنی، کارت بالانس کل (Glass + Count-up)، Bento گروه‌ها، FAB «گروه جدید»
- [ ] **صفحه گروه**: هدر کاور با Parallax، AvatarStack اعضا، تب‌های «فعالیت | تسویه‌حساب | اعضا»
- [ ] **ثبت هزینه**: انتخاب پرداخت‌کننده، انتخاب شرکت‌کنندگان با آواتار بزرگ (انیمیشن حلقه رشد)، سه روش تقسیم، **پیش‌نمایش زنده سهم‌ها**، تاریخ شمسی (پیش‌فرض امروز)، عکس فاکتور، یادداشت
- [ ] ویرایش/حذف هزینه با قوانین دسترسی و هشدار وجود Settlement
- [ ] **تسویه‌حساب**: کارت‌های «بدهکار ⟶ طلبکار» با فلش پالس‌دار، دکمه کپی شماره کارت، ثبت پرداخت (جزئی/کامل)، یادآوری (محدود به یک‌بار در روز)
- [ ] ثبت پرداخت با رسید (دوربین/گالری، پیش‌نمایش، چرخش) → تأیید/رد با دلیل → **میکرو-جشن** (تیک رسم‌شونده + گرادینت جشن + Haptic + کانفتی)
- [ ] دعوت به گروه: QR بزرگ، کپی لینک، Share بومی؛ صفحه تأیید «به گروه … می‌پیوندی؟»
- [ ] اعضا: خروج/حذف با قانون «ابتدا تسویه کن»
- [ ] تاریخچه فعالیت (Activity Feed) با آیکن‌های متناسب
- [ ] **پروفایل**: آواتار، ویرایش نام، کارت بانکی واقع‌نما با کپی، تغییر رمز، تنظیمات (تم، صدا، اعلان‌ها، آدرس سرور)
- [ ] اعلان‌ها: Local Notifications (یادآور خودکار بعد از X روز) — در Capacitor بومی، در وب با Web Notifications
- [ ] افکت صوتی «دینگ» کوتاه و قابل خاموش‌کردن
- [ ] **داده نمونه (Demo Mode)**: با یک کلیک سناریوی «سفر کیش» بارگذاری می‌شود تا در Pages نمایش کامل داشته باشد
- [ ] PWA: manifest، Service Worker (Workbox)، نصب روی هوم‌اسکرین، آفلاین کامل
- [ ] RTL کامل، اعداد فارسی، تاریخ شمسی (`date-fns-jalali`)
- [ ] دسترس‌پذیری: کنتراست WCAG AA، سایز لمس ≥ 44px، aria-labelها

### فاز ۴ — Backend (طبق بخش ۹ سند فنی)
- [ ] Prisma Schema دقیقاً مطابق جداول سند (users, groups, group_members, expenses, expense_participants, settlements, reminders, activity_log) + اصلاح `card_number`
- [ ] همه Endpointهای بخش ۹.۳ + JWT + bcrypt + اعتبارسنجی با Zod
- [ ] موتور محاسبات از `packages/core` استفاده می‌کند (یک منبع حقیقت)
- [ ] آپلود تصویر: S3-compatible با fallback ذخیره محلی
- [ ] Cron یادآور خودکار + Web Push (VAPID)
- [ ] Docker Compose (Postgres + API) برای اجرای یک‌دستوری + Seed سناریوی کیش
- [ ] تست‌های API (Supertest) برای جریان‌های اصلی
- [ ] `ApiAdapter` در فرانت + صفحه تنظیمات «اتصال به سرور»

### فاز ۵ — GitHub Pages
- [ ] `vite.config` با `base: '/dong/'` و `404.html` برای SPA fallback
- [ ] Workflow `pages.yml`: روی push به `main` → build → deploy با `actions/deploy-pages`
- [ ] آدرس نهایی: `https://soheilxcoder.github.io/dong/`
- [ ] بررسی: نصب PWA از Pages، آفلاین، لینک دعوت با hash، Lighthouse ≥ 90 در PWA/Performance/Accessibility
- [ ] **کار شما بعد از تحویل:** فقط Settings → Pages → Source: «GitHub Actions» را فعال کنید.

### فاز ۶ — آماده‌سازی Play Store
- [ ] Capacitor Android: `applicationId = ir.dong.app` (قابل تغییر)، نام «دُنگ»، Splash بومی، Status Bar هماهنگ با تم
- [ ] پلاگین‌ها: Haptics، Camera، Share، Clipboard، Local Notifications، Filesystem، App (Deep Link برای لینک دعوت)
- [ ] Adaptive Icon + Themed Icon (Android 13)، Edge-to-edge، Predictive Back
- [ ] `docs/PLAY_STORE.md`: ساخت Keystore، امضای AAB، `versionCode` ، Data Safety form، سیاست حریم خصوصی (صفحه `privacy.html` در Pages)، متن فروشگاه فارسی/انگلیسی، Target SDK 35
- [ ] اسکرین‌شات‌های فروشگاهی (۶ عدد) + Feature Graphic در `design/store/`
- [ ] Workflow اختیاری برای build خودکار AAB با Secrets

### فاز ۷ — کیفیت و تحویل
- [ ] تست E2E (Playwright) برای: ثبت‌نام → ساخت گروه → ۴ هزینه کیش → تسویه صحیح → ثبت و تأیید پرداخت
- [ ] بررسی روی Android واقعی (Chrome + WebView)، بررسی iOS Safari برای PWA
- [ ] README کامل با اسکرین‌شات، لینک دمو، راهنمای اجرا (`pnpm i && pnpm dev`)
- [ ] پاک‌سازی: اسناد به `docs/` منتقل و نام برند اصلاح می‌شود

---

## ۳. مواردی که فراتر از اسناد اضافه می‌کنم (ارزش افزوده)
1. **Demo Mode** با داده سناریوی کیش برای ارائه فوری در Pages
2. **تاریخ شمسی** و اعداد فارسی در همه‌جا (سند ذکر نکرده بود اما برای کاربر ایرانی ضروری است)
3. **تشخیص بانک از BIN** و نمایش لوگو/رنگ بانک روی کارت بانکی (سند: فاز بعد — ولی ارزان و بسیار جذاب است)
4. **Export تصویر خلاصه تسویه** برای ارسال در تلگرام/واتساپ («کی به کی چقدر بدهکاره» به‌صورت یک کارت تصویری زیبا)
5. **Deep Link** لینک دعوت که در اندروید مستقیم اپ را باز می‌کند
6. **Themed/Monochrome icon** و Dynamic Color-safe برای Android 13+

---

## ۴. سؤالاتی که پاسخ شما به آن‌ها قبل از شروع لازم است
(در پیام جداگانه پرسیده می‌شود)

---

## ۵. ترتیب تحویل
هر فاز که تمام شود، در همین برنچ commit می‌شود و پیش‌نمایش زنده (Live Preview) به شما نشان داده می‌شود تا بازخورد بدهید. تخمین حجم کار: فازهای ۱ تا ۳ و ۵ (نسخه قابل ارائه در Pages) اولویت اول؛ سپس ۴، ۶ و ۷.
