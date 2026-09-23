# راهنمای انتشار دُنگ در Google Play

## پیش‌نیازها
- Android Studio (Ladybug یا جدیدتر)، JDK 17، Android SDK 35
- حساب Google Play Console (۲۵ دلار یک‌بار)

## ۱. ساخت خروجی وب و همگام‌سازی
```bash
npm install
npm run build -w @dong/web
cd apps/web && npx cap sync android
```

## ۲. Keystore (فقط یک‌بار — امن نگه دارید!)
```bash
keytool -genkey -v -keystore dong-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias dong
```
سپس فایل `apps/web/android/keystore.properties` بسازید (در gitignore است):
```
storeFile=/absolute/path/dong-release.jks
storePassword=...
keyAlias=dong
keyPassword=...
```
و در `apps/web/android/app/build.gradle` بلوک signing زیر را اضافه کنید:
```gradle
def ksProps = new Properties()
def ksFile = rootProject.file("keystore.properties")
if (ksFile.exists()) ksProps.load(new FileInputStream(ksFile))
android {
  signingConfigs { release { if (ksFile.exists()) { storeFile file(ksProps['storeFile']); storePassword ksProps['storePassword']; keyAlias ksProps['keyAlias']; keyPassword ksProps['keyPassword'] } } }
  buildTypes { release { signingConfig signingConfigs.release; minifyEnabled true; shrinkResources true; proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro' } }
}
```

## ۳. ساخت AAB
```bash
cd apps/web/android && ./gradlew bundleRelease
# خروجی: app/build/outputs/bundle/release/app-release.aab
```
یا در Android Studio: **Build → Generate Signed Bundle / APK → Android App Bundle**.

## ۴. نسخه‌گذاری
هر انتشار: در `apps/web/android/app/build.gradle` مقدار `versionCode` را +۱ و `versionName` را به‌روز کنید.

## ۵. اطلاعات Play Console
| فیلد | مقدار پیشنهادی |
|---|---|
| App name | دُنگ — تقسیم هزینه گروهی |
| Short description (80) | حساب‌کتاب دنگی با دوستان؛ آخرش دقیقاً می‌گه کی به کی چقدر بده. |
| Category | Finance |
| App icon 512×512 | `design/icon/playstore-icon-512.png` |
| Feature graphic 1024×500 | `design/icon/feature-graphic-1024x500.png` |
| Screenshots | `design/store/*.png` (حداقل ۲، حداکثر ۸؛ نسبت ۹:۱۶) |
| Privacy policy URL | `https://soheilxcoder.github.io/dong/privacy.html` |
| Content rating | Everyone (پرسشنامه IARC: بدون محتوای حساس) |
| Target audience | 18+ (اپ مالی) |
| Ads | No |
| Data safety | بدون جمع‌آوری/اشتراک داده (حالت محلی). اگر سرور خودتان را فعال می‌کنید: "Personal info: Name, User IDs" جمع‌آوری می‌شود، رمزنگاری در انتقال: بله، قابل حذف: بله. |

### توضیح کامل (Full description)
```
دُنگ برای گروه‌هاییه که با هم خرج می‌کنن: سفر، خونه مشترک، دورهمی، کافه‌رفتن‌های هر هفته.

هر بار یکی حساب می‌کنه و همیشه همه حاضر نیستن. دُنگ همه این رفت‌وبرگشت‌ها رو در طول زمان جمع می‌زنه و آخرش با کمترین تعداد تراکنش می‌گه دقیقاً کی به کی چقدر بدهکاره.

✨ امکانات
• ثبت هزینه با انتخاب دقیق حاضرین (لازم نیست همه در همه هزینه‌ها باشن)
• تقسیم مساوی، دلخواه یا توسط حسابگر — با پیش‌نمایش زنده سهم هر نفر
• محاسبه دقیق تراز هر نفر و ساده‌سازی بدهی‌ها به کمترین تراکنش
• ثبت پرداخت با عکس رسید، پرداخت جزئی، تأیید یا رد توسط طلبکار
• شماره کارت بانکی با کپی یک‌ضربه‌ای و تشخیص خودکار بانک
• دعوت با لینک و QR، تاریخچه کامل فعالیت‌های گروه
• حالت تاریک کامل، تاریخ شمسی، طراحی مدرن و سریع
• کاملاً آفلاین — داده‌ها روی دستگاه خودت می‌مونه

هیچ تراکنش بانکی داخل اپ انجام نمی‌شه؛ دُنگ فقط حساب‌کتاب رو شفاف می‌کنه.
```

## ۶. چک‌لیست قبل از ارسال
- [ ] `targetSdkVersion = 35` (تنظیم شده در `variables.gradle`)
- [ ] آیکون Adaptive + Monochrome (تنظیم شده)
- [ ] Deep link `https://soheilxcoder.github.io/dong/…` (تنظیم شده در Manifest)
- [ ] مجوزها: INTERNET, VIBRATE, POST_NOTIFICATIONS, SCHEDULE_EXACT_ALARM — در فرم Permissions توضیح دهید (یادآوری بدهی).
- [ ] تست روی دستگاه واقعی: `./gradlew installDebug`
- [ ] Internal testing track → بعد Production

## ۷. به‌روزرسانی‌های بعدی
فقط `npm run build -w @dong/web && npx cap sync android` و ساخت مجدد AAB با `versionCode` جدید.
