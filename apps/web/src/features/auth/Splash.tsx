import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useStore } from '@/app/store';
import { hideBoot } from '@/lib/boot';

/** In-app splash (same look as the native/HTML splash). Shows an offline notice + retry when the server can't be reached on first open. */
export function Splash() {
  const { offline, init } = useStore();
  useEffect(() => { hideBoot(); }, []);
  return (
    <div className="fixed inset-0 grid place-items-center" style={{ background: `#053a35 url(${import.meta.env.BASE_URL}icons/splash-full.webp) center/cover no-repeat` }}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="flex flex-col items-center justify-end h-full pb-[18vh]">
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
