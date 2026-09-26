import { useState } from 'react';
import { ChevronDown, Users, Receipt, HandCoins, Link2, Bell, CreditCard, Activity, ShieldCheck, Smartphone } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sheet } from '@/design-system/ui';

const sections: { icon: typeof Users; title: string; steps: string[] }[] = [
  { icon: Users, title: 'ساخت گروه', steps: [
    'در صفحهٔ خانه روی دکمهٔ «+» (پایین چپ) بزن.',
    'یک نام بده (مثلاً «سفر شمال») و در صورت تمایل یک توضیح کوتاه یا عکس کاور.',
    '«ساخت گروه و دعوت دوستان» را بزن؛ مستقیم به صفحهٔ دعوت می‌روی.',
    'برای هر سفر، خانهٔ مشترک یا دورهمی یک گروه جدا بساز تا حساب‌ها قاطی نشود.',
  ] },
  { icon: Link2, title: 'دعوت دوستان', steps: [
    'داخل گروه روی آواتارهای اعضا (بالای صفحه) بزن تا صفحهٔ دعوت باز شود.',
    'دوستت QR را با دوربین گوشی اسکن می‌کند، یا لینک را با «اشتراک‌گذاری» برایش بفرست.',
    'اگر دوستت اپ ندارد، لینک در مرورگر باز می‌شود و همان‌جا می‌تواند ثبت‌نام و عضو شود.',
    'کسی لینک برایت فرستاده؟ روی آن بزن، یا در خانه «لینک دعوت داری؟» را انتخاب کن و لینک را بچسبان.',
    'هر بار لینک جدید بفرستی، آخرین هزینه‌ها هم داخلش هست؛ «لینک جدید» فقط وقتی لازم است که بخواهی لینک قبلی از کار بیفتد.',
  ] },
  { icon: Receipt, title: 'ثبت هزینه', steps: [
    'داخل گروه روی دکمهٔ «+» بزن.',
    '«بابت» (مثلاً شام) و «مبلغ کل» را وارد کن؛ تاریخ پیش‌فرض امروز است.',
    '«کی حساب کرد؟» را انتخاب کن — پیش‌فرض خودت هستی.',
    'در «کیا بودن؟» فقط کسانی را روشن بگذار که در آن خرج شریک بودند.',
    'روش تقسیم: «مساوی» (سهم برابر)، «دلخواه» (برای هر نفر مبلغ بنویس)، یا «حسابگر وارد می‌کند» (سهم بقیه را می‌نویسی، باقی‌مانده سهم خودت).',
    'پیش‌نمایش پایین صفحه سهم هر نفر را زنده نشان می‌دهد. می‌توانی عکس رسید هم ضمیمه کنی (خودکار فشرده می‌شود).',
    'برای ویرایش یا حذف، روی همان هزینه در تب «هزینه‌ها» بزن. هر تغییری در تب «فعالیت» ثبت می‌شود.',
  ] },
  { icon: HandCoins, title: 'تسویه‌حساب و پرداخت', steps: [
    'تب «تسویه‌حساب» می‌گوید دقیقاً کی به کی چقدر بدهد — با کمترین تعداد پرداخت.',
    'اگر بدهکاری: شماره کارت طرف را با یک ضربه کپی کن، از اپ بانکت واریز کن، بعد «ثبت پرداخت» بزن. می‌توانی بخشی از مبلغ را پرداخت کنی یا رسید ضمیمه کنی.',
    'اگر طلبکاری: پرداخت ثبت‌شده برایت «منتظر تأیید» می‌آید؛ پول که رسید «تأیید» بزن (با جشن کوچک!)، وگرنه «رد» با ذکر دلیل.',
    'فقط پرداخت‌های تأییدشده از حساب کم می‌شوند؛ تا وقتی تأیید نشده، بدهی سر جایش می‌ماند.',
    'با «یادآوری» یک پیام مؤدبانه برای بدهکار می‌رود.',
  ] },
  { icon: Activity, title: 'تب فعالیت‌ها', steps: [
    'همهٔ اتفاقات همهٔ گروه‌ها یک‌جا: هزینهٔ جدید، ویرایش، پرداخت، تأیید، رد و یادآوری.',
    'پرداخت‌هایی که منتظر تأیید تو هستند بالای همین صفحه نمایش داده می‌شوند.',
    'زنگولهٔ بالای خانه هم تعداد کارهای منتظر تو را نشان می‌دهد.',
  ] },
  { icon: CreditCard, title: 'شماره کارت', steps: [
    'در پروفایل روی کارت بانکی بزن و ۱۶ رقم را وارد کن؛ بانک خودکار شناسایی می‌شود.',
    'این شماره فقط به هم‌گروهی‌هایت نشان داده می‌شود تا راحت‌تر واریز کنند. هیچ پرداختی داخل دُنگ انجام نمی‌شود.',
  ] },
  { icon: Bell, title: 'اعلان‌ها', steps: [
    'در اپ اندروید، هزینهٔ جدید، پرداخت و تأیید/رد به‌صورت اعلان می‌آیند.',
    'در نسخهٔ وب، وقتی اپ باز است تغییرات به‌صورت پیام کوتاه بالا می‌آیند.',
  ] },
  { icon: ShieldCheck, title: 'داده‌ها و حریم خصوصی', steps: [
    'داده‌های هر گروه رمزنگاری‌شده بین اعضا همگام می‌شود؛ فقط اعضای همان گروه می‌توانند آن را بخوانند.',
    'اپ بدون اینترنت هم کار می‌کند و به‌محض اتصال همگام می‌شود.',
    'رمزت را فراموش کردی؟ اگر هنگام ثبت‌نام سؤال امنیتی گذاشته‌ای، از «رمز رو فراموش کردی؟» بازیابی کن.',
  ] },
  { icon: Smartphone, title: 'نصب روی گوشی', steps: [
    'اندروید: از صفحهٔ ورود یا همین پروفایل «دانلود اپ اندروید (APK)» را بزن و نصب کن.',
    'آیفون: صفحه را در Safari باز کن → دکمهٔ اشتراک‌گذاری → «Add to Home Screen».',
  ] },
];

export function HelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <Sheet open={open} onClose={onClose} title="راهنمای استفاده از دُنگ">
      <div className="flex flex-col gap-2 max-h-[70dvh] overflow-y-auto -mx-1 px-1 pb-2">
        {sections.map(({ icon: I, title, steps }, k) => (
          <div key={title} className="rounded-2xl bg-surface-2 overflow-hidden">
            <button onClick={() => setOpenIdx(openIdx === k ? null : k)} className="w-full flex items-center gap-3 p-3.5 text-right">
              <span className="h-9 w-9 rounded-xl grid place-items-center text-white shrink-0" style={{ background: 'var(--grad-brand)' }}><I size={18} /></span>
              <span className="flex-1 font-extrabold text-sm">{title}</span>
              <ChevronDown size={18} className={`text-ink-2 transition-transform ${openIdx === k ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
              {openIdx === k && (
                <motion.ol initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-4 pb-4 space-y-2 overflow-hidden">
                  {steps.map((t, i) => (
                    <li key={i} className="flex gap-2.5 text-[13px] leading-6 text-ink">
                      <span className="h-5 w-5 mt-0.5 rounded-full bg-brand/15 text-brand text-[11px] font-black grid place-items-center shrink-0 num">{i + 1}</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </motion.ol>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
