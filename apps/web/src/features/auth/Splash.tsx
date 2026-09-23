import { motion } from 'framer-motion';
import { Mascot } from '@/design-system/Mascot';

export function Splash() {
  return (
    <div className="fixed inset-0 grid place-items-center grain" style={{ background: 'var(--grad-hero)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="flex flex-col items-center gap-4">
        <Mascot mood="idle" size={140} />
        <h1 className="text-5xl font-black text-white tracking-tight">دُنگ</h1>
        <p className="text-white/70 font-medium">حساب‌کتاب دنگی، بدون دعوا</p>
      </motion.div>
    </div>
  );
}
