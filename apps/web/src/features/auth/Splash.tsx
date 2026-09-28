import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { WifiOff, RefreshCw, ShieldOff } from 'lucide-react';
import { useStore } from '@/app/store';
import { hideBoot } from '@/lib/boot';
import { Mascot } from '@/design-system/Mascot';

/** In-app splash (same look as the native/HTML splash). When the server can't be reached on first open it turns into a
 *  clear, full-screen "no connection" page (mascot + card) that sits ABOVE the HTML splash so it can never be hidden. */
export function Splash() {
  const { offline, init } = useStore();
  const [busy, setBusy] = useState(false);
  useEffect(() => { hideBoot(); }, []);
  useEffect(() => {
    // the HTML splash (#boot) may still be fading out — make sure it is gone the moment we have something to say
    if (offline) document.getElementById('boot')?.classList.add('hide');
  }, [offline]);
  const retry = async () => { setBusy(true); try { await init(); } finally { setTimeout(() => setBusy(false), 600); } };

  if (!offline) {
    return <div className="fixed inset-0" style={{ background: `#053a35 url(${import.meta.env.BASE_URL}icons/splash-full.webp) center/cover no-repeat` }} />;
  }
  return (
    <div className="fixed inset-0 overflow-y-auto" style={{ zIndex: 10000, background: 'linear-gradient(160deg,#0a5c46 0%,#053a35 55%,#031f1d 100%)' }} dir="rtl">
      <div className="min-h-full flex flex-col items-center justify-center px-6 py-10">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }} className="mb-4">
          <Mascot mood="confused" size={132} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="w-full max-w-sm rounded-3xl bg-white text-[#0b2b27] shadow-2xl px-5 py-6 text-center">
          <div className="mx-auto mb-3 grid place-items-center w-14 h-14 rounded-2xl bg-[#ffe9e6] text-[#d64545]"><WifiOff size={28} /></div>
          <h1 className="font-black text-xl">اتصال به سرور برقرار نشد</h1>
          <p className="text-[15px] leading-8 mt-2 text-[#3b4f4b]">
            اینترنت گوشی را بررسی کن. به‌محض وصل شدن، خودکار وارد می‌شوی.
          </p>
          <div className="mt-3 rounded-2xl bg-[#fff7e6] border border-[#ffe1a6] px-4 py-3 text-right flex gap-3 items-start">
            <ShieldOff size={20} className="shrink-0 mt-1 text-[#b7791f]" />
            <div className="text-sm leading-7 text-[#6b4f0d]">
              <b>فیلترشکن روشن است؟</b> ممکنه مشکل از همون باشه. سرور دُنگ داخل ایرانه؛ فیلترشکن رو خاموش کن و دوباره تلاش کن.
            </div>
          </div>
          <button onClick={() => { void retry(); }} disabled={busy}
            className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0a5c46] text-white font-extrabold px-5 py-3.5 text-base disabled:opacity-70">
            <RefreshCw size={18} className={busy ? 'animate-spin' : ''} /> {busy ? 'در حال تلاش…' : 'تلاش دوباره'}
          </button>
        </motion.div>
        <div className="text-white/60 text-xs mt-6">دُنگ · حساب‌کتاب مشترک، ساده و شفاف</div>
      </div>
    </div>
  );
}
