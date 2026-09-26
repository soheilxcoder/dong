import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, animate, motion, useReducedMotion } from 'framer-motion';
import { Check, Copy, X, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatAmount } from '@dong/core';
import { avatarColor, initials } from '@/lib/avatar';
import { copyText, haptic } from '@/lib/native';
import { useStore } from '@/app/store';
import { Mascot, type Mood } from './Mascot';

/* ---------- Avatar ---------- */
export function Avatar({ name, src, size = 40, ring = false, className = '' }: { name: string; src?: string | null; size?: number; ring?: boolean; className?: string }) {
  const bg = avatarColor(name);
  return (
    <div
      className={`relative shrink-0 rounded-full grid place-items-center font-extrabold text-white overflow-hidden ${ring ? 'ring-2 ring-bg' : ''} ${className}`}
      style={{ width: size, height: size, background: src ? undefined : `linear-gradient(135deg, ${bg}, ${bg}bb)`, fontSize: size * 0.38 }}
      aria-label={name}
    >
      {src ? <img src={src} alt={name} className="w-full h-full object-cover" /> : initials(name)}
    </div>
  );
}
export function AvatarStack({ names, size = 32, max = 5 }: { names: { name: string; src?: string | null }[]; size?: number; max?: number }) {
  const shown = names.slice(0, max);
  return (
    <div className="flex items-center" dir="ltr">
      {shown.map((n, i) => (
        <div key={i} style={{ marginLeft: i ? -size * 0.3 : 0, zIndex: shown.length - i }}><Avatar name={n.name} src={n.src} size={size} ring /></div>
      ))}
      {names.length > max && (
        <div className="grid place-items-center rounded-full bg-surface-2 text-ink-2 text-xs font-bold ring-2 ring-bg" style={{ width: size, height: size, marginLeft: -size * 0.3 }}>+{names.length - max}</div>
      )}
    </div>
  );
}

/* ---------- Count-up amount ---------- */
export function AmountText({ value, className = '', suffix = ' تومان', duration = 0.6 }: { value: number; className?: string; suffix?: string; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) { setDisplay(value); prev.current = value; return; }
    const c = animate(prev.current, value, { duration, ease: 'easeOut', onUpdate: (v) => setDisplay(Math.round(v)) });
    prev.current = value;
    return () => c.stop();
  }, [value, duration, reduce]);
  return <span className={`num ${className}`}>{formatAmount(display)}{suffix}</span>;
}

/* ---------- Balance chip ---------- */
export function BalanceChip({ value }: { value: number }) {
  if (value === 0) return <span className="chip bg-neutral2/15 text-neutral2">تسویه</span>;
  return value > 0
    ? <span className="chip bg-pos/15 text-pos">طلبکار {formatAmount(value)}</span>
    : <span className="chip bg-neg/15 text-neg">بدهکار {formatAmount(-value)}</span>;
}

/* ---------- Copy button ---------- */
export function CopyButton({ text, label = 'کپی', small = false, onLight = false }: { text: string; label?: string; small?: boolean; onLight?: boolean }) {
  const [ok, setOk] = useState(false);
  const toast = useStore((s) => s.toast);
  return (
    <button
      type="button"
      onClick={async (e) => { e.stopPropagation(); await copyText(text); haptic('light'); setOk(true); toast('کپی شد ✅', 'ok'); setTimeout(() => setOk(false), 1500); }}
      className={`inline-flex items-center gap-1.5 rounded-full font-bold transition ${small ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm'} ${ok ? 'bg-pos text-white' : onLight ? 'bg-white text-brand-2 shadow' : 'text-white shadow-sm'}`}
      style={ok || onLight ? undefined : { background: 'var(--grad-brand)' }}
      aria-label={label}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={ok ? 'ok' : 'copy'} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.15 }}>
          {ok ? <Check size={small ? 14 : 16} /> : <Copy size={small ? 14 : 16} />}
        </motion.span>
      </AnimatePresence>
      {ok ? 'کپی شد' : label}
    </button>
  );
}

/* ---------- Bottom sheet ---------- */
export function Sheet({ open, onClose, title, children, full = false }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; full?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div className="absolute inset-0 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            role="dialog" aria-modal
            className={`glass relative w-full max-w-lg rounded-t-[28px] overflow-hidden ${full ? 'h-[94dvh]' : 'max-h-[92dvh]'} flex flex-col`}
            style={{ background: 'rgb(var(--c-surface) / 0.92)' }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            drag="y" dragConstraints={{ top: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, i) => { if (i.offset.y > 120 || i.velocity.y > 600) onClose(); }}
          >
            <div className="pt-3 pb-1 grid place-items-center cursor-grab"><div className="h-1.5 w-12 rounded-full bg-ink/20" /></div>
            {title && (
              <div className="flex items-center justify-between px-5 py-2">
                <h2 className="text-lg font-extrabold">{title}</h2>
                <button onClick={onClose} className="p-2 rounded-full bg-surface-2 text-ink-2" aria-label="بستن"><X size={18} /></button>
              </div>
            )}
            <div className="overflow-y-auto px-5 pb-[calc(var(--safe-bottom)+24px)] flex-1">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Toasts ---------- */
export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="fixed bottom-[calc(var(--safe-bottom)+88px)] inset-x-0 z-[60] flex flex-col items-center gap-2 pointer-events-none px-4">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} initial={{ y: 20, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 10, opacity: 0, scale: 0.95 }}
            className={`glass px-4 py-2.5 rounded-full text-sm font-bold shadow-lg ${t.kind === 'ok' ? 'text-pos' : t.kind === 'err' ? 'text-neg' : 'text-ink'}`}
            style={{ background: 'rgb(var(--c-surface) / 0.9)' }}>
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Confetti (8–10 particles) ---------- */
export function Confetti() {
  const n = useStore((s) => s.celebrate);
  const reduce = useReducedMotion();
  const [bursts, setBursts] = useState<number[]>([]);
  useEffect(() => { if (!n || reduce) return; setBursts((b) => [...b, n]); const t = setTimeout(() => setBursts((b) => b.filter((x) => x !== n)), 1400); return () => clearTimeout(t); }, [n, reduce]);
  const colors = ['#22C55E', '#F5B942', '#0FB88A', '#F97362', '#0891B2'];
  return (
    <div className="fixed inset-0 pointer-events-none z-[70] overflow-hidden">
      {bursts.map((b) => Array.from({ length: 10 }).map((_, i) => {
        const a = (i / 10) * Math.PI * 2; const r = 120 + (i % 3) * 40;
        return (
          <motion.span key={`${b}-${i}`} className="absolute left-1/2 top-1/2 block rounded-sm" style={{ width: 10, height: 14, background: colors[i % colors.length] }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
            animate={{ x: Math.cos(a) * r, y: Math.sin(a) * r + 160, opacity: 0, rotate: 360 + i * 40, scale: 0.6 }}
            transition={{ duration: 1.2, ease: [0.2, 0.8, 0.3, 1] }} />
        );
      }))}
    </div>
  );
}

/* ---------- Empty state ---------- */
export function Empty({ mood = 'waiting', title, text, action }: { mood?: Mood; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-6 gap-3">
      <Mascot mood={mood} size={110} />
      <h3 className="text-lg font-extrabold mt-2">{title}</h3>
      {text && <p className="text-ink-2 text-sm leading-7 max-w-xs">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ---------- Page header ---------- */
export function PageHeader({ title, back = true, right }: { title: string; back?: boolean; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-30 glass flex items-center gap-2 px-3 py-3" style={{ paddingTop: 'calc(var(--safe-top) + 12px)', background: 'rgb(var(--c-bg) / 0.75)' }}>
      {back && <button onClick={() => nav(-1)} className="p-2 rounded-full hover:bg-surface-2" aria-label="بازگشت"><ChevronRight size={22} /></button>}
      <h1 className="text-lg font-extrabold flex-1 truncate">{title}</h1>
      {right}
    </header>
  );
}

/* ---------- Field with shake on error ---------- */
export function Field({ label, error, children }: { label?: string; error?: string | null; children: ReactNode }) {
  return (
    <div className="mb-4">
      {label && <label className="label">{label}</label>}
      <div className={error ? 'animate-shake' : ''} key={error ?? 'ok'}>{children}</div>
      {error && <p className="text-neg text-xs font-semibold mt-1.5">{error}</p>}
    </div>
  );
}

/* ---------- Segmented tabs with sliding indicator ---------- */
export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="relative grid rounded-2xl bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} className={`relative z-10 py-2.5 text-sm font-bold rounded-xl transition-colors ${value === o.value ? 'text-white' : 'text-ink-2'}`}>
          {value === o.value && <motion.span layoutId="seg" className="absolute inset-0 rounded-xl" style={{ background: 'var(--grad-brand)' }} transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- Animated check ---------- */
export function DrawCheck({ size = 72 }: { size?: number }) {
  return (
    <svg viewBox="0 0 72 72" width={size} height={size}>
      <motion.circle cx="36" cy="36" r="32" fill="none" stroke="url(#cg)" strokeWidth="4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5 }} />
      <defs><linearGradient id="cg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#22C55E" /><stop offset="1" stopColor="#F5B942" /></linearGradient></defs>
      <motion.path d="M22 37 L32 47 L51 27" fill="none" stroke="#22C55E" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.35 }} />
    </svg>
  );
}
