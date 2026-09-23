import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, Check, X, CalendarDays } from 'lucide-react';
import { format, parseISO } from 'date-fns-jalali';
import { faIR } from 'date-fns-jalali/locale';
import type { SplitType } from '@dong/core';
import { formatAmount, parseAmount, splitEqual, validateCustomSplit, toPersianDigits } from '@dong/core';
import { useStore } from '@/app/store';
import { Avatar, Field, PageHeader, Segmented } from '@/design-system/ui';
import { fileToDataUrl, haptic } from '@/lib/native';

export function ExpenseFormPage() {
  const { id = '', expenseId } = useParams();
  const nav = useNavigate();
  const { user, groups, adapter, toast, fireCelebration } = useStore();
  const g = groups.find((x) => x.group.id === id);
  const editing = expenseId ? g?.expenses.find((e) => e.id === expenseId) : undefined;

  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [paidBy, setPaidBy] = useState(user!.id);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [selected, setSelected] = useState<string[]>([]);
  const [split, setSplit] = useState<SplitType>('equal');
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [img, setImg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!g) return;
    if (editing) {
      setTitle(editing.title); setAmountStr(String(editing.totalAmount)); setPaidBy(editing.paidBy);
      setDate(editing.paidAt.slice(0, 10)); setSelected(editing.participants.map((p) => p.userId)); setSplit(editing.splitType);
      setCustom(Object.fromEntries(editing.participants.map((p) => [p.userId, String(p.amountOwed)]))); setNotes(editing.notes ?? ''); setImg(editing.receiptImageUrl ?? null);
    } else setSelected(g.members.map((m) => m.userId));
  }, [g, editing]);

  const total = parseAmount(amountStr);
  const shares = useMemo(() => {
    if (!selected.length || total <= 0) return [];
    if (split === 'equal') return splitEqual(total, selected);
    return selected.map((userId) => ({ userId, amountOwed: parseAmount(custom[userId] ?? '0') }));
  }, [selected, total, split, custom]);
  const check = split === 'equal' ? { ok: true as const, diff: 0 } : validateCustomSplit(total, shares);

  if (!g) return null;
  const toggle = (uid: string) => { haptic('light'); setSelected((s) => (s.includes(uid) ? s.filter((x) => x !== uid) : [...s, uid])); };

  const submit = async () => {
    setErr(null);
    if (!title.trim()) return setErr('عنوان را وارد کن');
    if (total <= 0) return setErr('مبلغ را وارد کن');
    if (!selected.length) return setErr('حداقل یک نفر را انتخاب کن');
    if (!check.ok) return setErr(`مجموع سهم‌ها با مبلغ کل ${check.diff > 0 ? `${formatAmount(check.diff)} تومان کمتر` : `${formatAmount(-check.diff)} تومان بیشتر`} است`);
    setBusy(true);
    try {
      const input = { title: title.trim(), totalAmount: total, paidBy, paidAt: new Date(date + 'T12:00:00').toISOString(), splitType: split, participants: shares, receiptImageUrl: img, notes: notes || null };
      if (editing) { await adapter.updateExpense(editing.id, input); toast('ویرایش شد', 'ok'); }
      else { await adapter.addExpense(g.group.id, input); toast('هزینه ثبت شد 🎉', 'ok'); fireCelebration(); }
      haptic('success'); nav(`/g/${id}`, { replace: true });
    } catch (e) { setErr((e as Error).message); haptic('error'); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-dvh mx-auto max-w-lg pb-44">
      <PageHeader title={editing ? 'ویرایش هزینه' : 'ثبت هزینه'} />
      <div className="px-5 pt-3">
        <Field label="بابت"><input className="input text-lg font-bold" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً شام، تاکسی، بلیط…" autoFocus={!editing} /></Field>
        <Field label="مبلغ کل (تومان)">
          <input className="input num text-3xl font-black text-center tracking-wide" inputMode="numeric" value={total ? formatAmount(total) : ''} onChange={(e) => setAmountStr(e.target.value)} placeholder="۰" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="تاریخ">
            <label className="input flex items-center gap-2 cursor-pointer relative">
              <CalendarDays size={18} className="text-ink-2" /><span className="text-sm font-bold">{toPersianDigits(format(parseISO(date), 'd MMMM yyyy', { locale: faIR }))}</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="absolute inset-0 opacity-0 w-full" />
            </label>
          </Field>
          <Field label="کی حساب کرد؟">
            <select className="input" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
              {g.members.map((m) => <option key={m.userId} value={m.userId}>{m.user.fullName}{m.userId === user!.id ? ' (من)' : ''}</option>)}
            </select>
          </Field>
        </div>

        <Field label={`کیا بودن؟ (${formatAmount(selected.length)} نفر)`}>
          <div className="flex gap-3 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
            {g.members.map((m) => {
              const on = selected.includes(m.userId);
              return (
                <button key={m.userId} type="button" onClick={() => toggle(m.userId)} className="flex flex-col items-center gap-1.5 shrink-0 w-[68px]">
                  <span className="relative">
                    <motion.span animate={{ scale: on ? 1 : 0, opacity: on ? 1 : 0 }} className="absolute -inset-1 rounded-full" style={{ background: 'var(--grad-brand)' }} />
                    <span className={`relative block rounded-full transition ${on ? '' : 'opacity-50 grayscale'}`}><Avatar name={m.user.fullName} src={m.user.avatarUrl} size={56} /></span>
                    {on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -bottom-0.5 -left-0.5 h-5 w-5 rounded-full bg-pos text-white grid place-items-center ring-2 ring-bg"><Check size={12} strokeWidth={3} /></motion.span>}
                  </span>
                  <span className={`text-[11px] font-bold truncate w-full text-center ${on ? '' : 'text-ink-2'}`}>{m.user.fullName.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 mt-2 text-xs font-bold">
            <button type="button" onClick={() => setSelected(g.members.map((m) => m.userId))} className="text-brand">همه</button>·
            <button type="button" onClick={() => setSelected([paidBy])} className="text-brand">فقط پرداخت‌کننده</button>
          </div>
        </Field>

        <Field label="روش تقسیم">
          <Segmented value={split} onChange={setSplit} options={[{ value: 'equal', label: 'مساوی' }, { value: 'custom', label: 'دلخواه' }, { value: 'by_payer', label: 'حسابگر وارد می‌کند' }]} />
        </Field>

        {/* live preview */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-extrabold text-sm">پیش‌نمایش سهم هر نفر</p>
            {split !== 'equal' && <span className={`chip ${check.ok ? 'bg-pos/15 text-pos' : 'bg-neg/15 text-neg'}`}>{check.ok ? 'جمع درست است' : check.diff > 0 ? `${formatAmount(check.diff)} مانده` : `${formatAmount(-check.diff)} اضافه`}</span>}
          </div>
          {shares.length === 0 ? <p className="text-xs text-ink-2">مبلغ و شرکت‌کننده‌ها را وارد کن…</p> : (
            <ul className="flex flex-col gap-2">
              {shares.map((s) => {
                const m = g.members.find((x) => x.userId === s.userId)!;
                return (
                  <li key={s.userId} className="flex items-center gap-3">
                    <Avatar name={m.user.fullName} size={30} />
                    <span className="flex-1 text-sm font-semibold">{m.user.fullName}{s.userId === paidBy && <span className="text-[10px] text-brand mr-1">پرداخت‌کننده</span>}</span>
                    {split === 'equal' ? <motion.span key={s.amountOwed} initial={{ scale: 1.15 }} animate={{ scale: 1 }} className="num font-extrabold">{formatAmount(s.amountOwed)}</motion.span>
                      : <input className="input !min-h-9 w-32 num text-left font-bold" inputMode="numeric" value={custom[s.userId] ? formatAmount(parseAmount(custom[s.userId])) : ''} placeholder="۰" onChange={(e) => setCustom({ ...custom, [s.userId]: e.target.value })} />}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-4">
          <label className="label">فاکتور (اختیاری)</label>
          {img ? <div className="relative"><img src={img} className="rounded-2xl w-full max-h-56 object-contain bg-surface-2" alt="" /><button onClick={() => setImg(null)} className="absolute top-2 left-2 p-2 rounded-full glass text-neg"><X size={16} /></button></div>
            : <label className="btn-ghost w-full cursor-pointer"><Camera size={18} /> عکس فاکتور<input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImg(await fileToDataUrl(f)); }} /></label>}
        </div>
        <Field label="یادداشت (اختیاری)"><textarea className="input py-3 min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>

      <div className="fixed bottom-0 inset-x-0 z-40 mx-auto max-w-lg px-5 pb-[calc(var(--safe-bottom)+16px)] pt-3" style={{ background: 'linear-gradient(to top, rgb(var(--c-bg)) 70%, transparent)' }}>
        {err && <motion.p key={err} initial={{ x: -6 }} animate={{ x: 0 }} className="animate-shake text-neg text-xs font-bold mb-2 text-center">{err}</motion.p>}
        <button onClick={submit} disabled={busy} className="btn-primary w-full text-base">{editing ? 'ذخیره تغییرات' : 'ثبت هزینه'}{total > 0 && <span className="num opacity-80">· {formatAmount(total)}</span>}</button>
      </div>
    </div>
  );
}
