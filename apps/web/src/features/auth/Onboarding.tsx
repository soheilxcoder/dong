import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/app/store';
import { Mascot } from '@/design-system/Mascot';

const slides = [
  { title: 'با دوستات جمع شو', text: 'یک گروه بساز، لینک یا QR رو بفرست؛ همه با یک ضربه عضو می‌شن.', art: <GroupArt /> },
  { title: 'هزینه‌ها رو ثبت کن', text: 'هر کی حساب کرد، همون لحظه ثبتش کن. فقط کسایی که بودن سهم می‌گیرن.', art: <ReceiptArt /> },
  { title: 'دُنگ حسابشو صاف می‌کنه', text: 'همه رفت‌وبرگشت‌ها جمع می‌شه و آخرش با کمترین تراکنش می‌گه کی به کی چقدر بده.', art: <Mascot mood="happy" size={170} /> },
];

export function Onboarding() {
  const [i, setI] = useState(0);
  const nav = useNavigate();
  const set = useStore((s) => s.setSettings);
  const done = () => { set({ onboarded: true }); nav('/auth', { replace: true }); };
  return (
    <div className="min-h-dvh flex flex-col grain relative" style={{ background: 'var(--grad-hero)', paddingTop: 'var(--safe-top)' }}>
      <button onClick={done} className="self-start m-4 text-white/80 text-sm font-bold px-3 py-1.5 rounded-full bg-white/10">رد کردن</button>
      <div className="flex-1 grid place-items-center px-8">
        <AnimatePresence mode="wait">
          <motion.div key={i} initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} transition={{ duration: 0.3 }} className="flex flex-col items-center text-center gap-6">
            <div className="h-48 grid place-items-center">{slides[i].art}</div>
            <h2 className="text-3xl font-black text-white">{slides[i].title}</h2>
            <p className="text-white/75 leading-8 max-w-xs">{slides[i].text}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="px-6 pb-[calc(var(--safe-bottom)+28px)] flex flex-col gap-5">
        <div className="flex justify-center gap-2">
          {slides.map((_, k) => <motion.span key={k} animate={{ width: k === i ? 28 : 8 }} className="h-2 rounded-full bg-white/90" style={{ opacity: k === i ? 1 : 0.4 }} />)}
        </div>
        <button onClick={() => (i < slides.length - 1 ? setI(i + 1) : done())} className="btn bg-white text-[#0a5c46] text-base shadow-xl">
          {i < slides.length - 1 ? 'بعدی' : 'بزن بریم'}
        </button>
      </div>
    </div>
  );
}

function GroupArt() {
  const c = ['#F5B942', '#F97362', '#34D8A8', '#8B5CF6'];
  return (
    <div className="relative w-56 h-44">
      {c.map((col, k) => (
        <motion.div key={k} className="absolute rounded-full grid place-items-center text-white font-black text-xl shadow-xl"
          style={{ width: 72, height: 72, background: col, left: 20 + k * 40, top: k % 2 ? 70 : 20 }}
          animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2.4, delay: k * 0.25 }}>
          {['ع', 'ر', 'ح', 'م'][k]}
        </motion.div>
      ))}
    </div>
  );
}
function ReceiptArt() {
  return (
    <motion.div className="w-40 rounded-2xl bg-white/95 p-4 shadow-2xl text-right" initial={{ rotate: -4 }} animate={{ rotate: [-4, 3, -4] }} transition={{ repeat: Infinity, duration: 4 }}>
      <div className="h-3 w-24 rounded bg-[#1E1B18]/80 mb-3" />
      {[70, 50, 60].map((w, k) => <div key={k} className="flex justify-between mb-2"><div className="h-2 rounded bg-[#1E1B18]/25" style={{ width: w }} /><div className="h-2 w-8 rounded bg-[#0FB88A]" /></div>)}
      <div className="border-t border-dashed border-[#1E1B18]/20 mt-3 pt-2 flex justify-between"><div className="h-3 w-10 rounded bg-[#1E1B18]/70" /><div className="h-3 w-12 rounded bg-[#F5B942]" /></div>
    </motion.div>
  );
}
