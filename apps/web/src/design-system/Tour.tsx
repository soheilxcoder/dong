import { useEffect, useLayoutEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '@/app/store';
import { Mascot, type Mood } from './Mascot';

export interface TourStep { target?: string; title: string; text: string; mood?: Mood }

/**
 * First-run coach marks. Highlights `[data-tour=…]` elements with a spotlight cut-out
 * and shows a card with the mascot. Shown once per tour id (persisted in settings).
 */
export function Tour({ id, steps, delay = 500 }: { id: string; steps: TourStep[]; delay?: number }) {
  const { settings, setSettings } = useStore();
  const [i, setI] = useState(-1);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const done = !!settings.tours[id];

  useEffect(() => { if (done) return; const t = setTimeout(() => setI(0), delay); return () => clearTimeout(t); }, [done, delay]);

  useLayoutEffect(() => {
    if (i < 0) return;
    const step = steps[i];
    const el = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null;
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const upd = () => setRect(el.getBoundingClientRect());
      const t = setTimeout(upd, 350); upd();
      window.addEventListener('resize', upd); window.addEventListener('scroll', upd, true);
      return () => { clearTimeout(t); window.removeEventListener('resize', upd); window.removeEventListener('scroll', upd, true); };
    }
    setRect(null);
  }, [i, steps]);

  if (done || i < 0) return null;
  const step = steps[i];
  const finish = () => { setSettings({ tours: { ...settings.tours, [id]: true } }); setI(-1); };
  const next = () => (i < steps.length - 1 ? setI(i + 1) : finish());
  const pad = 8;
  const r = rect ? { x: rect.left - pad, y: rect.top - pad, w: rect.width + pad * 2, h: rect.height + pad * 2 } : null;
  const below = r ? r.y + r.h + 240 < window.innerHeight : true;

  return (
    <AnimatePresence>
      <motion.div key="tour" className="fixed inset-0 z-[80]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <svg className="absolute inset-0 w-full h-full" onClick={next}>
          <defs>
            <mask id="tour-mask">
              <rect width="100%" height="100%" fill="white" />
              {r && <motion.rect rx={20} initial={false} animate={{ x: r.x, y: r.y, width: r.w, height: r.h }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} fill="black" />}
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(8,20,24,0.72)" mask="url(#tour-mask)" />
          {r && <motion.rect rx={20} initial={false} animate={{ x: r.x, y: r.y, width: r.w, height: r.h }} fill="none" stroke="#34D8A8" strokeWidth={2.5} strokeDasharray="6 6" transition={{ type: 'spring', stiffness: 300, damping: 30 }} />}
        </svg>
        <motion.div
          key={i}
          initial={{ opacity: 0, y: below ? 16 : -16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          className="absolute inset-x-4 mx-auto max-w-md"
          style={r ? (below ? { top: r.y + r.h + 14 } : { bottom: window.innerHeight - r.y + 14 }) : { top: '50%', transform: 'translateY(-50%)' }}
        >
          <div className="card p-4 relative overflow-visible" style={{ borderColor: 'rgb(var(--c-brand) / 0.35)' }}>
            <div className="flex gap-3">
              <div className="shrink-0 -mt-8"><Mascot mood={step.mood ?? 'idle'} size={64} /></div>
              <div className="flex-1 min-w-0">
                <h3 className="font-extrabold text-base">{step.title}</h3>
                <p className="text-sm text-ink-2 leading-7 mt-1">{step.text}</p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="flex gap-1.5">{steps.map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-5 bg-brand' : 'w-1.5 bg-ink/20'}`} />)}</div>
              <div className="flex items-center gap-3">
                <button onClick={finish} className="text-xs font-bold text-ink-2">رد کردن</button>
                <button onClick={next} className="btn-primary !min-h-10 text-sm px-4">{i < steps.length - 1 ? 'بعدی' : 'فهمیدم'}</button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
