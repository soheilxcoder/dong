import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useStore } from '@/app/store';

/** In-app splash (same look as the native/HTML splash). Shows an offline notice + retry when the server can't be reached on first open. */
export function Splash() {
  const { offline, init } = useStore();
  useEffect(() => { document.getElementById('boot')?.classList.add('hide'); }, []);
  return (
    <div className="fixed inset-0 grid place-items-center" style={{ background: 'radial-gradient(90vmax 90vmax at 50% 38%, #0e6b58 0%, #0a5446 40%, #053a35 75%, #042e2c 100%)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="flex flex-col items-center -translate-y-[4vh]">
        <img src={`${import.meta.env.BASE_URL}icons/splash-art.webp`} alt="" className="w-[min(96vw,460px)] -mb-[9vw]" style={{ WebkitMaskImage: 'radial-gradient(circle at 50% 50%, #000 36%, transparent 68%)', maskImage: 'radial-gradient(circle at 50% 50%, #000 36%, transparent 68%)' }} />
        <h1 className="text-white font-black mt-2.5 leading-tight" style={{ fontSize: 'clamp(44px,14vw,72px)' }}>دُنگ</h1>
        <p className="text-white/65 text-[15px] mt-1">حساب‌کتاب دنگی، بدون دعوا</p>
        {offline && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-8 mx-6 rounded-2xl border border-white/20 bg-white/10 text-white px-5 py-4 text-center max-w-xs">
            <WifiOff className="mx-auto mb-2 opacity-90" />
            <div className="font-extrabold">اتصال به سرور برقرار نشد</div>
            <div className="text-white/70 text-sm mt-1 leading-7">اینترنت گوشی را روشن کن. به‌محض وصل شدن، خودکار وارد می‌شوی.</div>
            <button onClick={() => { void init(); }} className="mt-3 inline-flex items-center gap-2 rounded-full bg-white text-[#0a5c46] font-extrabold px-5 py-2 text-sm"><RefreshCw size={16} /> تلاش دوباره</button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
