import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, BellRing, Camera, Check, RotateCw, X, Clock, HandCoins } from 'lucide-react';
import type { Balance, Settlement, Transfer } from '@dong/core';
import { formatAmount, formatCardNumber, parseAmount, detectBank } from '@dong/core';
import { useStore } from '@/app/store';
import { Avatar, CopyCardNumber, Empty, Sheet, DrawCheck } from '@/design-system/ui';
import type { GroupDetail } from '@/data/adapter';
import { ding, compressImage, haptic, notify, rotateDataUrl } from '@/lib/native';
import { fmtDateTime } from '@/lib/date';
import { Tour } from '@/design-system/Tour';

export function SettleTab({ g, balances, transfers }: { g: GroupDetail; balances: Balance[]; transfers: Transfer[] }) {
  const { user, adapter, toast, fireCelebration, settings } = useStore();
  const me = user!;
  const member = (id: string) => g.members.find((m) => m.userId === id)?.user;
  const name = (id: string) => member(id)?.fullName ?? 'حذف‌شده';
  const [pay, setPay] = useState<Transfer | null>(null);
  const [reject, setReject] = useState<Settlement | null>(null);
  const [reason, setReason] = useState('');
  const [celebrated, setCelebrated] = useState(false);

  const pending = g.settlements.filter((s) => s.status === 'pending_confirmation');
  const history = g.settlements.filter((s) => s.status !== 'pending_confirmation').slice(0, 20);

  const confirm = async (s: Settlement) => {
    try { await adapter.confirmSettlement(s.id); haptic('success'); ding(settings.sound); fireCelebration(); setCelebrated(true); setTimeout(() => setCelebrated(false), 1600); }
    catch (e) { toast((e as Error).message, 'err'); }
  };
  const remind = async (t: Transfer) => {
    try { await adapter.sendReminder(g.group.id, t.from, t.amount); haptic('light'); toast(`یادآوری برای ${name(t.from)} ثبت شد`, 'ok'); notify('یادآوری دُنگ', `${name(t.from)}، ${formatAmount(t.amount)} تومان به ${name(t.to)} بدهکاری`); }
    catch (e) { toast((e as Error).message, 'err'); }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* pending confirmations */}
      {pending.length > 0 && (
        <section>
          <h3 className="text-sm font-extrabold text-ink-2 mb-2 flex items-center gap-1"><Clock size={14} /> در انتظار تأیید</h3>
          <div className="flex flex-col gap-2">
            {pending.map((s) => (
              <motion.div key={s.id} layout className="card p-3.5 border-amber2/30" style={{ borderColor: 'rgb(var(--c-amber) / 0.35)' }}>
                <div className="flex items-center gap-3">
                  <Avatar name={name(s.fromUser)} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">{name(s.fromUser)} ← {name(s.toUser)}</p>
                    <p className="text-xs text-ink-2">{fmtDateTime(s.submittedAt)}{s.note ? ` · ${s.note}` : ''}</p>
                  </div>
                  <p className="num font-black text-amber2">{formatAmount(s.amount)}</p>
                </div>
                {s.receiptImageUrl && <img src={s.receiptImageUrl} alt="رسید" className="mt-3 rounded-xl max-h-52 w-full object-contain bg-surface-2" />}
                {s.toUser === me.id ? (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <button onClick={() => confirm(s)} className="btn text-white" style={{ background: 'var(--grad-celebrate)' }}><Check size={18} /> تأیید دریافت</button>
                    <button onClick={() => { setReject(s); setReason(''); }} className="btn-ghost text-neg"><X size={18} /> رد</button>
                  </div>
                ) : s.fromUser === me.id ? (
                  <button onClick={() => adapter.cancelSettlement(s.id)} className="text-xs text-ink-2 font-bold mt-3">لغو این پرداخت</button>
                ) : null}
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* transfers */}
      <section>
        <h3 className="text-sm font-extrabold text-ink-2 mb-2">کی به کی چقدر بده</h3>
        {transfers.length === 0 ? (
          <Empty mood="happy" title="تمومه! صاف صافه 🎉" text="هیچ‌کس به کسی بدهکار نیست." />
        ) : (
          <div className="flex flex-col gap-2">
            {transfers.map((t, i) => {
              const cred = member(t.to);
              const iOwe = t.from === me.id; const iGet = t.to === me.id;
              const bank = cred?.cardNumber ? detectBank(cred.cardNumber) : null;
              return (
                <motion.div key={`${t.from}-${t.to}`} data-tour={i === 0 ? 'transfer' : undefined} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className={`card p-4 ${iOwe ? 'ring-1 ring-neg/40' : iGet ? 'ring-1 ring-pos/40' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col items-center gap-1 w-16"><Avatar name={name(t.from)} size={44} /><span className="text-xs font-bold truncate w-full text-center">{name(t.from)}</span></div>
                    <div className="flex-1 flex flex-col items-center">
                      <p className="num text-xl font-black">{formatAmount(t.amount)}</p>
                      <div className="flex items-center gap-0.5 text-brand mt-0.5">
                        {[0, 1, 2].map((k) => <ArrowLeft key={k} size={16} className="animate-pulseArrow" style={{ animationDelay: `${k * 0.2}s` }} />)}
                      </div>
                      <p className="text-[11px] text-ink-2">تومان</p>
                    </div>
                    <div className="flex flex-col items-center gap-1 w-16"><Avatar name={name(t.to)} size={44} /><span className="text-xs font-bold truncate w-full text-center">{name(t.to)}</span></div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    {cred?.cardNumber ? (
                      <CopyCardNumber number={cred.cardNumber} bankName={bank?.name} bankColor={bank?.color} />
                    ) : <span className="text-[11px] text-ink-2">شماره کارت ثبت نشده — از طریق پیام هماهنگ کنید</span>}
                    <span className="flex-1" />
                    {(iOwe || member(t.from)?.username.startsWith('local_') || member(t.from)?.username.startsWith('demo_')) && (
                      <button onClick={() => setPay(t)} className="btn-primary !min-h-10 text-sm px-4"><HandCoins size={16} /> ثبت پرداخت</button>
                    )}
                    {iGet && <button onClick={() => remind(t)} className="btn-ghost !min-h-10 text-sm px-3"><BellRing size={16} /> یادآوری</button>}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* balances */}
      <section className="card p-4">
        <h3 className="text-sm font-extrabold text-ink-2 mb-3">تراز هر نفر</h3>
        <ul className="flex flex-col gap-2">
          {[...balances].sort((a, b) => b.balance - a.balance).map((b) => (
            <li key={b.userId} className="flex items-center gap-3">
              <Avatar name={name(b.userId)} size={30} />
              <span className="flex-1 text-sm font-semibold">{name(b.userId)}</span>
              <div className="w-32 h-2 rounded-full bg-surface-2 overflow-hidden" dir="ltr">
                <motion.div className={`h-full rounded-full ${b.balance >= 0 ? 'bg-pos' : 'bg-neg'}`} initial={{ width: 0 }} animate={{ width: `${Math.min(100, (Math.abs(b.balance) / Math.max(1, ...balances.map((x) => Math.abs(x.balance)))) * 100)}%` }} />
              </div>
              <span className={`num text-sm font-extrabold w-24 text-left ${b.balance > 0 ? 'text-pos' : b.balance < 0 ? 'text-neg' : 'text-neutral2'}`}>{b.balance > 0 ? '+' : ''}{formatAmount(b.balance)}</span>
            </li>
          ))}
        </ul>
      </section>

      {history.length > 0 && (
        <section>
          <h3 className="text-sm font-extrabold text-ink-2 mb-2">تاریخچه پرداخت‌ها</h3>
          <ul className="flex flex-col gap-1.5">
            {history.map((s) => (
              <li key={s.id} className="card p-3 flex items-center gap-3 text-sm">
                <span className={`h-8 w-8 rounded-xl grid place-items-center ${s.status === 'confirmed' ? 'bg-pos/15 text-pos' : 'bg-neg/15 text-neg'}`}>{s.status === 'confirmed' ? <Check size={16} /> : <X size={16} />}</span>
                <div className="flex-1 min-w-0"><p className="font-semibold truncate">{name(s.fromUser)} ← {name(s.toUser)}</p><p className="text-[11px] text-ink-2">{fmtDateTime(s.submittedAt)}{s.rejectReason ? ` · رد شد: ${s.rejectReason}` : ''}</p></div>
                <span className="num font-extrabold">{formatAmount(s.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {transfers.length > 0 && <Tour id="settle" delay={500} steps={[
        { title: 'کی به کی چقدر بده', text: 'هر کارت یک پرداخت لازم رو نشون می‌ده. بدهکار «ثبت پرداخت» می‌زنه و رسید می‌ذاره؛ طلبکار تأیید می‌کنه و همه‌چیز صاف می‌شه.', target: 'transfer', mood: 'happy' },
      ]} />}
      <PaySheet t={pay} onClose={() => setPay(null)} g={g} />

      <Sheet open={!!reject} onClose={() => setReject(null)} title="رد پرداخت">
        <p className="text-sm text-ink-2 mb-3 leading-6">دلیل رد را کوتاه بنویس تا برای {reject && name(reject.fromUser)} نمایش داده شود.</p>
        <input className="input mb-4" placeholder="مثلاً: مبلغ اشتباهه" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        <button className="btn-danger w-full" onClick={async () => { try { await adapter.rejectSettlement(reject!.id, reason); setReject(null); haptic('error'); toast('پرداخت رد شد'); } catch (e) { toast((e as Error).message, 'err'); } }}>رد کردن</button>
      </Sheet>

      <AnimatePresence>
        {celebrated && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[65] grid place-items-center pointer-events-none">
            <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="glass rounded-[28px] p-6 flex flex-col items-center gap-2" style={{ background: 'rgb(var(--c-surface) / 0.9)' }}>
              <DrawCheck /><p className="font-black text-lg">تأیید شد!</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PaySheet({ t, onClose, g }: { t: Transfer | null; onClose: () => void; g: GroupDetail }) {
  const { adapter, toast } = useStore();
  const [amount, setAmount] = useState('');
  const [img, setImg] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const name = (id: string) => g.members.find((m) => m.userId === id)?.user.fullName ?? '';
  const open = !!t;
  const val = amount ? parseAmount(amount) : (t?.amount ?? 0);
  const submit = async () => {
    if (!t) return;
    if (val <= 0 || val > t.amount) { toast('مبلغ باید بین ۱ و کل بدهی باشد', 'err'); return; }
    setBusy(true);
    try { await adapter.submitSettlement(g.group.id, t.to, val, img, note || null, t.from); haptic('medium'); toast('پرداخت ثبت شد', 'ok'); onClose(); setAmount(''); setImg(null); setNote(''); }
    catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="ثبت پرداخت">
      {t && (
        <div className="pb-2">
          <div className="flex items-center justify-center gap-4 mb-5">
            <Avatar name={name(t.from)} size={48} /><ArrowLeft className="text-brand" /><Avatar name={name(t.to)} size={48} />
          </div>
          <label className="label">مبلغ (کل بدهی: {formatAmount(t.amount)} تومان)</label>
          <input className="input num text-2xl font-black text-center mb-1" inputMode="numeric" value={amount ? formatAmount(parseAmount(amount)) : formatAmount(t.amount)} onChange={(e) => setAmount(e.target.value || '0')} />
          <p className="text-[11px] text-ink-2 mb-4 text-center">می‌تونی بخشی از بدهی رو هم بپردازی (پرداخت جزئی)</p>
          <label className="label">عکس رسید</label>
          {img ? (
            <div className="relative mb-4"><img src={img} className="rounded-2xl w-full max-h-64 object-contain bg-surface-2" alt="رسید" />
              <div className="absolute top-2 left-2 flex gap-2">
                <button onClick={async () => setImg(await rotateDataUrl(img))} className="p-2 rounded-full glass"><RotateCw size={16} /></button>
                <button onClick={() => setImg(null)} className="p-2 rounded-full glass text-neg"><X size={16} /></button>
              </div></div>
          ) : (
            <label className="btn-ghost w-full mb-4 cursor-pointer"><Camera size={18} /> انتخاب از دوربین / گالری<input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImg(await compressImage(f, 'receipt')); }} /></label>
          )}
          <input className="input mb-4" placeholder="یادداشت (اختیاری)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn-primary w-full text-base" disabled={busy} onClick={submit}>ثبت و ارسال برای تأیید</button>
        </div>
      )}
    </Sheet>
  );
}
