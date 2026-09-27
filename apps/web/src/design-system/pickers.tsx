import { useMemo, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Check, CalendarDays } from 'lucide-react';
import { addMonths, format, getDate, getDay, getDaysInMonth, isAfter, isSameDay, parseISO, startOfDay, startOfMonth, subDays } from 'date-fns-jalali';
import { faIR } from 'date-fns-jalali/locale';
import { toPersianDigits } from '@dong/core';
import { Avatar, Sheet } from './ui';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const fmtJalali = (isoDate: string, f = 'd MMMM yyyy') => toPersianDigits(format(parseISO(isoDate), f, { locale: faIR }));
const WEEK = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

/**
 * Jalali calendar bottom sheet. value/onChange use ISO yyyy-MM-dd (Gregorian, what the API stores).
 * Future dates are disabled (you cannot have paid for something tomorrow).
 */
export function DatePickerSheet({ open, onClose, value, onChange }: { open: boolean; onClose: () => void; value: string; onChange: (isoDate: string) => void }) {
  const today = startOfDay(new Date());
  const selected = parseISO(value);
  const [month, setMonth] = useState(() => startOfMonth(selected));
  const [dir, setDir] = useState(1);
  const cells = useMemo(() => {
    const first = startOfMonth(month);
    const lead = (getDay(first) + 1) % 7; // date-fns: 0=Sunday → Persian week starts Saturday
    const n = getDaysInMonth(month);
    const out: (Date | null)[] = Array.from({ length: lead }, () => null);
    for (let i = 0; i < n; i++) out.push(new Date(first.getFullYear(), first.getMonth(), first.getDate() + i));
    return out;
  }, [month]);
  const quick: { l: string; d: Date }[] = [{ l: 'امروز', d: today }, { l: 'دیروز', d: subDays(today, 1) }, { l: 'پریروز', d: subDays(today, 2) }];
  const pick = (d: Date) => { onChange(iso(d)); onClose(); };
  const go = (delta: number) => { setDir(delta); setMonth((m) => addMonths(m, delta)); };
  const nextDisabled = isAfter(startOfMonth(addMonths(month, 1)), today);
  return (
    <Sheet open={open} onClose={onClose} title="تاریخ پرداخت">
      <div className="px-5 pb-6">
        <div className="flex gap-2 mb-4">
          {quick.map((q) => (
            <button key={q.l} type="button" onClick={() => pick(q.d)} className={`chip flex-1 justify-center !py-2 text-sm font-bold ${isSameDay(q.d, selected) ? 'bg-brand text-white' : 'bg-surface-2 text-ink'}`}>{q.l}</button>
          ))}
        </div>
        <div className="card p-3 overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => go(-1)} className="p-2 rounded-full hover:bg-surface-2" aria-label="ماه قبل"><ChevronRight size={20} /></button>
            <span className="font-extrabold">{toPersianDigits(format(month, 'MMMM yyyy', { locale: faIR }))}</span>
            <button type="button" onClick={() => go(1)} disabled={nextDisabled} className="p-2 rounded-full hover:bg-surface-2 disabled:opacity-30" aria-label="ماه بعد"><ChevronLeft size={20} /></button>
          </div>
          <div className="grid grid-cols-7 text-center text-[11px] font-bold text-ink-2 mb-1">{WEEK.map((w) => <span key={w} className="py-1">{w}</span>)}</div>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div key={iso(month)} initial={{ x: dir * -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: dir * 40, opacity: 0 }} transition={{ duration: 0.18 }} className="grid grid-cols-7 gap-y-1">
              {cells.map((d, i) => {
                if (!d) return <span key={`e${i}`} />;
                const sel = isSameDay(d, selected), isToday = isSameDay(d, today), future = isAfter(d, today), friday = i % 7 === 6;
                return (
                  <button key={iso(d)} type="button" disabled={future} onClick={() => pick(d)}
                    className={`relative mx-auto h-10 w-10 rounded-full grid place-items-center text-sm font-bold transition active:scale-90 disabled:opacity-25 ${sel ? 'text-white shadow-md' : friday ? 'text-neg' : 'text-ink'} ${!sel && !future ? 'hover:bg-surface-2' : ''}`}
                    style={sel ? { background: 'var(--grad-brand)' } : undefined}>
                    {toPersianDigits(String(getDate(d)))}
                    {isToday && !sel && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-brand" />}
                  </button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
        <p className="text-center text-xs text-ink-2 mt-3 flex items-center justify-center gap-1.5"><CalendarDays size={14} /> انتخاب‌شده: <span className="font-bold text-ink">{fmtJalali(value, 'EEEE d MMMM yyyy')}</span></p>
      </div>
    </Sheet>
  );
}

/** Pretty replacement for a native <select>: list of people with avatar + check mark. */
export function PersonPickerSheet({ open, onClose, title, value, onChange, people, meId, extra }: {
  open: boolean; onClose: () => void; title: string; value: string; onChange: (id: string) => void;
  people: { id: string; name: string; avatarUrl?: string | null }[]; meId?: string; extra?: ReactNode;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="px-4 pb-6 flex flex-col gap-1.5">
        {people.map((p, i) => {
          const on = p.id === value;
          return (
            <motion.button key={p.id} type="button" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} onClick={() => { onChange(p.id); onClose(); }}
              className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-right transition active:scale-[0.98] ${on ? 'bg-brand/10 ring-2 ring-brand/40' : 'hover:bg-surface-2'}`}>
              <Avatar name={p.name} src={p.avatarUrl} size={40} />
              <span className="flex-1 min-w-0">
                <span className="block font-bold truncate">{p.name}{p.id === meId && <span className="text-[11px] text-ink-2 font-semibold mr-1.5">(من)</span>}</span>
              </span>
              <span className={`h-6 w-6 rounded-full grid place-items-center transition ${on ? 'text-white' : 'bg-surface-2 text-transparent'}`} style={on ? { background: 'var(--grad-brand)' } : undefined}><Check size={14} strokeWidth={3} /></span>
            </motion.button>
          );
        })}
        {extra}
      </div>
    </Sheet>
  );
}
