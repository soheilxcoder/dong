# راهنمای کامل انتشار «دُنگ» در Google Play (قدم‌به‌قدم، برای کسی که تا حالا انجام نداده)

> خلاصه: **هیچ‌چیز روی کامپیوترت لازم نیست نصب کنی.** GitHub خودش فایل Play (AAB) را می‌سازد.
> تو فقط ۳ کار داری: (۱) ۴ کلید امضا را در GitHub ثبت کنی، (۲) حساب تپسل بسازی و ۳ شناسه را ثبت کنی، (۳) در کافه‌بازار (و در صورت تمایل Play Console) فرم‌ها را طبق جدول‌های پایین پر کنی و فایل را آپلود کنی.

---

## مرحله ۰ — چیزهایی که باید داشته باشی
| چی | کجا | هزینه |
|---|---|---|
| حساب Google Play Console | https://play.google.com/console | ۲۵ دلار یک‌بار |
| حساب تپسل (برای تبلیغ) | https://app.tapsell.ir | رایگان |
| حساب پیشخوان کافه‌بازار (انتشار در ایران) | https://pishkhan.cafebazaar.ir | رایگان |
| دسترسی به ریپوی GitHub `soheilxcoder/dong` | داری | — |

ℹ️ تبلیغات با **تپسل** است (حساب و تسویه ایرانی). Google Play برای ساکنان ایران حساب توسعه‌دهنده باز نمی‌کند؛ اگر حساب Play داری (یا از طریق فرد مورد اعتماد در کشور دیگر) مراحل ۴ تا ۶ را هم انجام بده، در غیر این صورت مرحله ۲٫۵ (کافه‌بازار) کافی است. تپسل روی Play هم کار می‌کند.

---

## مرحله ۱ — کلید امضا (فقط یک‌بار، ۵ دقیقه)
کلید آپلود قبلاً برایت ساخته شده و در پوشه‌ی **`release-keys/`** ریپو (خارج از git) است:
- `dong-upload.keystore` — خودِ کلید
- `dong-upload.keystore.b64` — همان کلید به‌صورت متن
- `SECRETS.txt` — رمزها

1. برو به GitHub → ریپوی `dong` → **Settings → Secrets and variables → Actions → New repository secret**
2. این ۴ تا را دقیقاً با همین نام‌ها بساز (مقدارها در `SECRETS.txt`):

| Name | Value |
|---|---|
| `ANDROID_KEYSTORE_B64` | کل محتوای فایل `dong-upload.keystore.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | از SECRETS.txt |
| `ANDROID_KEY_ALIAS` | `dong` |
| `ANDROID_KEY_PASSWORD` | از SECRETS.txt |

3. از پوشه `release-keys/` **پشتیبان امن** بگیر (پسوردمنیجر / درایو رمزدار). 

---

## مرحله ۲ — تبلیغات تپسل (۱۵ دقیقه)
تبلیغ در اپ از قبل پیاده شده (یک بنر ۳۲۰×۵۰ پایین صفحه + یک تبلیغ تمام‌صفحه‌ی کم‌تکرار بعد از ثبت هزینه/تأیید پرداخت، حداکثر هر ۳ دقیقه یک‌بار و نه در دقیقه‌ی اول). تا وقتی شناسه‌های واقعی را ندهی، **تبلیغ‌های تستی تپسل** نمایش داده می‌شود (درآمدی ندارد).

1. https://app.tapsell.ir → ثبت‌نام (شماره موبایل ایرانی کافی است) → ورود.
2. منوی **اپلیکیشن‌ها → افزودن اپلیکیشن** → پلتفرم: **اندروید** → نام: `دُنگ` → مارکت: کافه‌بازار (یا «سایر») → نام پکیج: `ir.dong.app` → ثبت.
3. در صفحه‌ی اپ، **کلید اپلیکیشن (App ID)** را می‌بینی (یک UUID مثل `76798342-99a7-…`). کپی کن.
4. **جایگاه‌های تبلیغاتی → افزودن جایگاه (Zone)**:
   - نوع **بنر استاندارد** → نام `dong-banner` → ذخیره → `Zone ID` را کپی کن.
   - نوع **تبلیغ آنی (Interstitial)** → نام `dong-interstitial` → ذخیره → `Zone ID` را کپی کن.
5. در GitHub → Settings → Secrets → Actions، ۳ تا secret بساز:

| Name | Value |
|---|---|
| `TAPSELL_APP_ID` | کلید اپلیکیشن |
| `TAPSELL_BANNER_ZONE` | Zone ID بنر |
| `TAPSELL_INTERSTITIAL_ZONE` | Zone ID تبلیغ آنی |

6. **اطلاعات مالی** را در پنل تپسل (پروفایل → اطلاعات حساب/شبا) تکمیل کن تا تسویه انجام شود. تسویه ماهانه به حساب بانکی ایرانی است.
7. ❗ هرگز خودت روی تبلیغ‌های اپ‌ات کلیک نکن (تقلب محسوب می‌شود و حساب مسدود می‌شود).
8. اختیاری: اگر بعداً حساب AdMob داشتی، در پنل تپسل «شبکه‌های تبلیغاتی → AdMob» را اضافه کن؛ تپسل خودش بین شبکه‌ها مدیریت (Mediation) می‌کند و کد اپ تغییری لازم ندارد (فقط آداپتور `ir.tapsell.mediation.adapter:admob` باید به `app/build.gradle` اضافه شود — به من بگو انجام می‌دهم).

---

## مرحله ۲٫۵ — انتشار در کافه‌بازار (مسیر اصلی برای کاربران ایرانی — ۳۰ دقیقه، رایگان)
1. https://pishkhan.cafebazaar.ir → ثبت‌نام توسعه‌دهنده (کد ملی + شماره موبایل) → تأیید.
2. **برنامه‌ی جدید** → نام: `دُنگ — تقسیم هزینه گروهی` → دسته: **مالی / ابزارها** → «برنامه رایگان است».
3. تب **بسته (APK)** → فایل `dong-latest.apk` از Releases گیت‌هاب را آپلود کن (بازار APK می‌خواهد، نه AAB).
4. تب **اطلاعات**: توضیح کوتاه/کامل از مرحله ۵ همین سند، آیکون `design/icon/playstore-icon-512.png`، اسکرین‌شات‌ها `design/store/*.png`، «تبلیغات دارد: بله»، آدرس سیاست حریم خصوصی: `https://soheilxcoder.github.io/dong/privacy.html`.
5. تب **دسترسی‌ها**: برای POST_NOTIFICATIONS بنویس «یادآوری بدهی‌ها».
6. **ارسال برای بررسی**. بازبینی بازار معمولاً ۱ تا ۳ روز کاری است.
7. **مایکت** (https://developer.myket.ir) هم دقیقاً همین APK را می‌پذیرد — می‌توانی همزمان آنجا هم بگذاری.

⚠️ در پنل تپسل، مارکت اپ را همان مارکتی بگذار که منتشر می‌کنی (بازار/مایکت)؛ روی درآمد و تأیید اثر دارد.

---

## مرحله ۳ — گرفتن فایل Play (AAB)
1. GitHub → تب **Actions** → workflow **Android APK** → **Run workflow** (یا هر push خودش اجرا می‌شود).
2. ۳ دقیقه صبر کن. سپس **Releases → apk-latest** → فایل **`dong-latest.aab`** را دانلود کن.
3. در توضیح release چک کن نوشته باشد: «امضا: کلید آپلود شما (Play-ready)» و «تبلیغات: تپسل واقعی». اگر نوشت «کلید موقت»، یعنی secrets مرحله ۱ درست ثبت نشده.

هر بار workflow اجرا شود، `versionCode` خودکار زیاد می‌شود؛ لازم نیست دستی عدد عوض کنی.

---

## مرحله ۴ — Play Console: ساخت اپ
**Create app** → App name: `دُنگ — تقسیم هزینه گروهی` → Default language: *Persian* → App: *App* → Free → تیک‌های Declarations → Create.

سپس در **Dashboard** فهرست «Set up your app» را به ترتیب پر کن:

### 4.1 Privacy policy
`https://soheilxcoder.github.io/dong/privacy.html`

### 4.2 App access
*All functionality is available without special access* (ثبت‌نام داخل اپ محلی است و نیاز به حساب خاصی ندارد).

### 4.3 Ads
**Yes, my app contains ads.**

### 4.4 Content rating
پرسشنامه IARC → Category: *Utility, Productivity, Communication or Other* → همه‌ی پاسخ‌ها **No** (خشونت، جنسی، قمار واقعی، …) → «Does the app share user location?» No → «Allow users to interact?» No → «Does the app contain ads?» **Yes** → Save → نتیجه معمولاً *Everyone / PEGI 3*.

### 4.5 Target audience
Age: **18 and over** فقط (اپ مالی). «Appeal to children?» No.

### 4.6 News app / COVID / Government
همه **No**.

### 4.7 Data safety (مهم‌ترین فرم — دقیقاً این‌طور جواب بده)
- Does your app collect or share any of the required user data types? → **Yes**
- Is all of the user data collected by your app encrypted in transit? → **Yes**
- Do you provide a way for users to request that their data is deleted? → **Yes** (خروج از گروه / حذف اپ، توضیح در Privacy)

Data types:
| نوع داده | جمع‌آوری؟ | اشتراک؟ | پردازش موقت؟ | اجباری؟ | هدف |
|---|---|---|---|---|---|
| Personal info → **Name** | Yes | No | No | Required | App functionality |
| Personal info → **User IDs** (نام کاربری) | Yes | No | No | Required | App functionality |
| Financial info → **Other financial info** (شماره کارت – اختیاری) | Yes | No | No | Optional | App functionality |
| Photos → **Photos** (رسید – اختیاری) | Yes | No | No | Optional | App functionality |
| App activity → **Other user-generated content** (هزینه‌ها) | Yes | No | No | Required | App functionality |
| Device or other IDs → **Device or other IDs** (Advertising ID – تپسل) | Yes | **Yes** (Tapsell) | No | Required | Advertising or marketing, Analytics |
| App info & performance → **Diagnostics** | Yes | Yes | No | Required | Analytics (Tapsell SDK) |

(داده‌های گروه فقط بین اعضای همان گروه و به‌صورت رمزشده رد و بدل می‌شود؛ ما سروری نداریم که آن را بخواند.)

### 4.8 Government apps / Financial features
Financial features → **«My app doesn't provide any financial features»** (دُنگ فقط حساب‌کتاب می‌کند؛ هیچ پرداختی انجام نمی‌دهد) — این را حتماً انتخاب کن وگرنه مدارک مالی می‌خواهند.

### 4.9 Health
No.

---

## مرحله ۵ — Store listing (صفحه‌ی اپ)
| فیلد | مقدار |
|---|---|
| App name (30) | `دُنگ — تقسیم هزینه گروهی` |
| Short description (80) | `حساب‌کتاب دنگی با دوستان؛ آخرش دقیقاً می‌گه کی به کی چقدر بده.` |
| Full description | متن پایین |
| App icon 512×512 | `design/icon/playstore-icon-512.png` |
| Feature graphic 1024×500 | `design/icon/feature-graphic-1024x500.png` |
| Phone screenshots (۲ تا ۸) | `design/store/01…07.png` |
| Category | **Finance** |
| Tags | Expense tracker, Bill splitting |
| Contact email | ایمیل خودت |
| Website | `https://soheilxcoder.github.io/dong/` |

### Full description
```
دُنگ برای گروه‌هاییه که با هم خرج می‌کنن: سفر، خونه مشترک، دورهمی، کافه‌رفتن‌های هر هفته.

هر بار یکی حساب می‌کنه و همیشه همه حاضر نیستن. دُنگ همه این رفت‌وبرگشت‌ها رو در طول زمان جمع می‌زنه و آخرش با کمترین تعداد تراکنش می‌گه دقیقاً کی به کی چقدر بدهکاره.

✨ امکانات
• ثبت هزینه با انتخاب دقیق حاضرین (لازم نیست همه در همه هزینه‌ها باشن)
• تقسیم مساوی، دلخواه یا توسط حسابگر — با پیش‌نمایش زنده سهم هر نفر
• محاسبه دقیق تراز هر نفر و ساده‌سازی بدهی‌ها به کمترین تراکنش
• ثبت پرداخت با عکس رسید، پرداخت جزئی، تأیید یا رد توسط طلبکار
• شماره کارت بانکی با کپی یک‌ضربه‌ای و تشخیص خودکار بانک
• دعوت با لینک و QR — اعضا خودکار و رمزنگاری‌شده همگام می‌شن، بدون نیاز به سرور
• تاریخچه کامل فعالیت‌ها، یادآوری بدهی، تاریخ شمسی
• حالت تاریک کامل، طراحی مدرن و سریع، راهنمای تعاملی اول کار

هیچ تراکنش بانکی داخل اپ انجام نمی‌شه؛ دُنگ فقط حساب‌کتاب رو شفاف می‌کنه.
```

---

## مرحله ۶ — آپلود و انتشار
1. **Testing → Internal testing → Create new release** → فایل `dong-latest.aab` را بکش داخل.
   - بار اول Play می‌پرسد **Play App Signing** → *Use Google-generated key* را قبول کن (کلید تو فقط «کلید آپلود» است؛ همین درست است).
2. Release name خودکار پر می‌شود؛ Release notes: `نسخه اول دُنگ 🎉` → **Next → Save → Send for review**.
3. **Testers** → یک لیست ایمیل بساز، ایمیل خودت و دوستانت را اضافه کن → لینک «Copy link» را برایشان بفرست → نصب کنند و ۴ کار را تست کنند: ساخت گروه → پیوستن با لینک → ثبت هزینه → ثبت و تأیید پرداخت.
4. وقتی مطمئن شدی: **Production → Create new release** → همان AAB (یا جدیدترین) → Countries: *Add countries → همه* → Send for review.
5. بازبینی Google معمولاً ۱ تا ۷ روز طول می‌کشد. نتیجه به ایمیلت می‌آید.

---

## مرحله ۷ — به‌روزرسانی‌های بعدی
هر تغییری در کد → push → GitHub خودش AAB جدید با versionCode بالاتر می‌سازد → Play Console → Production → Create new release → آپلود → Send for review. همین.

---

## اگر Google ایراد گرفت (رایج‌ترین‌ها)
| پیام Google | راه‌حل |
|---|---|
| «Advertising ID declaration» | Policy → App content → Advertising ID → **Yes, uses Advertising ID** → هدف: Advertising, Analytics |
| «Data safety mismatch» | جدول 4.7 را دقیقاً همان‌طور پر کن (Device IDs + Diagnostics به‌خاطر SDK تپسل اجباری است) |
| «Financial features» | «doesn't provide any financial features» را انتخاب کن |
| «Deceptive behavior / permissions» | مجوزهای اپ فقط INTERNET، VIBRATE، POST_NOTIFICATIONS، AD_ID است — در فرم Permissions بنویس: «Notifications for debt reminders» |
| «Upload key mismatch» | secrets مرحله ۱ عوض شده؛ همان keystore اول را برگردان یا از Play Console → App integrity → Request upload key reset |
