import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Home, Receipt, UserPlus, Clock, Plus, Wallet, FolderOpen, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { computeNetBalances, simplifyDebts, userBalance, formatAmount } from '@dong/core';
import type { Transfer } from '@dong/core';
import { useStore } from '@/app/store';
import { AvatarStack, AmountText, BalanceChip, Empty } from '@/design-system/ui';
import { TransferCard } from '@/features/settlements/TransferCard';
import { PaySheet } from '@/features/settlements/SettleTab';
import { haptic } from '@/lib/native';
import { useState } from 'react';
import { Mascot } from '@/design-system/Mascot';
import { fmtAgo } from '@/lib/date';
import type { GroupDetail } from '@/data/adapter';

/* ---------- shared hero (same art language as the group header / balance card) ---------- */
function Hero({ title, sub, icon, mood = 'idle', children }: { title: string; sub: string; icon: React.ReactNode; mood?: 'idle' | 'happy' | 'waiting' | 'confused'; children?: React.ReactNode }) {
  const nav = useNavigate();
  return (
    <div className="relative overflow-hidden curve-bottom" style={{ background: 'var(--grad-hero)' }}>
      <div className="hero-blob hero-blob-a" /><div className="hero-blob hero-blob-b" />
      <div className="relative px-4 pb-7" style={{ paddingTop: 'calc(var(--safe-top) + 12px)' }}>
        <div className="flex items-center justify-between text-white">
          <button onClick={() => nav('/')} className="group flex items-center gap-1.5 pr-2 pl-4 h-10 rounded-full text-sm font-extrabold text-white backdrop-blur-md active:scale-95 transition" style={{ background: 'rgba(6,18,22,0.42)', boxShadow: '0 0 0 1px rgba(255,255,255,0.22) inset' }} aria-label="بازگشت به خانه">
            <ChevronRight size={18} className="opacity-80 -ml-1" />
            <span className="grid place-items-center h-7 w-7 rounded-full bg-white/20"><Home size={15} strokeWidth={2.5} /></span>
            <span>خانه</span>
          </button>
          <span className="h-10 w-10 rounded-full grid place-items-center bg-white/15 text-white">{icon}</span>
        </div>
        <div className="flex items-end justify-between mt-4 gap-3">
          <div className="text-white">
            <h1 className="text-2xl font-black leading-tight">{title}</h1>
            <p className="text-white/80 text-sm mt-1">{sub}</p>
          </div>
          <Mascot mood={mood} size={84} className="shrink-0 drop-shadow-lg" />
        </div>
        {children}
      </div>
    </div>
  );
}

const ACTIONS = {
  expense: { title: 'ثبت هزینه', sub: 'هزینه رو برای کدوم گروه ثبت کنیم؟', icon: <Receipt size={18} />, to: (id: string) => `/g/${id}/expense/new`, cta: 'ثبت هزینه در این گروه' },
  invite: { title: 'دعوت دوستان', sub: 'لینک و QR کدوم گروه رو می‌فرستی؟', icon: <UserPlus size={18} />, to: (id: string) => `/g/${id}/invite`, cta: 'دعوت به این گروه' },
} as const;

/** /pick/:action — choose the group first, then do the thing. */
export function PickGroupPage() {
  const { action = 'expense' } = useParams();
  const a = ACTIONS[(action as keyof typeof ACTIONS) in ACTIONS ? (action as keyof typeof ACTIONS) : 'expense'];
  const { user, groups } = useStore();
  const nav = useNavigate();
  const me = user!;
  const list = useMemo(() => groups.map((g) => {
    const balances = computeNetBalances(g.members.map((m) => m.userId), g.expenses, g.settlements);
    const last = g.expenses[0]?.createdAt ?? g.group.createdAt;
    return { g, mine: userBalance(me.id, balances), last, spent: g.expenses.reduce((s, e) => s + e.totalAmount, 0) };
  }).sort((x, y) => y.last.localeCompare(x.last)), [groups, me.id]);

  return (
    <motion.div className="min-h-dvh pb-32" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      <Hero title={a.title} sub={a.sub} icon={a.icon} mood={groups.length ? 'happy' : 'waiting'} />
      <div className="px-5 mt-3">
        {list.length === 0 ? (
          <Empty mood="waiting" title="هنوز گروهی نداری" text="اول یک گروه بساز؛ بعد از همین‌جا ادامه بده." action={<button onClick={() => nav('/new-group')} className="btn-primary"><Plus size={16} /> گروه جدید</button>} />
        ) : (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2.5 px-1 mt-2 mb-0.5">
              <span className="h-8 w-8 rounded-xl grid place-items-center text-white shadow-md" style={{ background: 'var(--grad-brand)' }}><FolderOpen size={15} /></span>
              <div><p className="text-sm font-extrabold">یک گروه انتخاب کن</p><p className="text-[11px] text-ink-2">{formatAmount(list.length)} گروه داری</p></div>
            </div>
            {list.map(({ g, mine, last, spent }, i) => (
              <motion.button key={g.group.id} onClick={() => nav(a.to(g.group.id))} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} whileTap={{ scale: 0.98 }}
                className="card text-right p-3 flex items-center gap-3 relative overflow-hidden">
                <div className="h-14 w-14 rounded-2xl shrink-0 overflow-hidden grid place-items-center text-white font-black text-xl shadow-md" style={{ background: g.group.coverImageUrl ? `url(${g.group.coverImageUrl}) center/cover` : 'var(--grad-hero)' }}>
                  {!g.group.coverImageUrl && g.group.name.trim().charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-extrabold truncate text-[15px]">{g.group.name}</h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <AvatarStack names={g.members.map((m) => ({ name: m.user.fullName, src: m.user.avatarUrl }))} size={20} max={4} />
                    <span className="text-[11px] text-ink-2">{formatAmount(g.members.length)} نفر · {fmtAgo(last)}</span>
                  </div>
                  {spent > 0 && <p className="text-[11px] text-ink-2 mt-1">خرج گروه: <span className="num font-bold text-ink">{formatAmount(spent)}</span> تومان</p>}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <BalanceChip value={mine} />
                  <span className="text-[11px] font-extrabold text-brand flex items-center gap-0.5">{a.cta.split(' ')[0]} <ChevronLeft size={14} /></span>
                </div>
              </motion.button>
            ))}
            <button onClick={() => nav('/new-group')} className="card p-3 flex items-center gap-3 text-right border-dashed" style={{ borderStyle: 'dashed' }}>
              <span className="h-11 w-11 rounded-2xl bg-brand/12 text-brand grid place-items-center"><Plus size={20} /></span>
              <span className="text-sm font-bold">گروه جدید بساز</span>
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/** /settle — everything I owe and everything owed to me, across all groups, with the totals on top. */
export function SettleAllPage() {
  const { user, groups, adapter, toast } = useStore();
  const nav = useNavigate();
  const me = user!;
  const [pay, setPay] = useState<{ g: GroupDetail; t: Transfer } | null>(null);
  const rows = useMemo(() => groups.flatMap((g) => {
    const balances = computeNetBalances(g.members.map((m) => m.userId), g.expenses, g.settlements);
    return simplifyDebts(balances).filter((t) => t.from === me.id || t.to === me.id).map((t) => ({ g, t, iOwe: t.from === me.id }));
  }), [groups, me.id]);
  const owe = rows.filter((r) => r.iOwe).reduce((s, r) => s + r.t.amount, 0);
  const owed = rows.filter((r) => !r.iOwe).reduce((s, r) => s + r.t.amount, 0);
  const net = owed - owe;
  const pendingForMe = groups.flatMap((g) => g.settlements).filter((s) => s.status === 'pending_confirmation' && s.toUser === me.id);
  const debts = rows.filter((r) => r.iOwe), credits = rows.filter((r) => !r.iOwe);
  const remind = (g: GroupDetail) => async (t: Transfer) => {
    const who = g.members.find((m) => m.userId === t.from)?.user.fullName ?? '';
    try { await adapter.sendReminder(g.group.id, t.from, t.amount); haptic('light'); toast(`یادآوری برای ${who} ثبت شد`, 'ok'); } catch (e) { toast((e as Error).message, 'err'); }
  };

  return (
    <motion.div className="min-h-dvh pb-32" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      <Hero title="تسویه‌حساب" sub={rows.length === 0 ? 'همه‌چیز صافه؛ دمت گرم' : net < 0 ? 'یه‌کم بدهی داری — الان صافش کن' : net > 0 ? 'طلبت رو یادآوری کن' : 'بدهی و طلبت برابره'} icon={<Wallet size={18} />} mood={rows.length === 0 ? 'happy' : net < 0 ? 'waiting' : 'idle'}>
        <div className="mt-5 rounded-card p-4 relative overflow-hidden" style={{ background: 'rgb(var(--c-surface) / 0.92)', boxShadow: '0 18px 40px -20px rgba(0,0,0,0.45)' }}>
          <div className="absolute -left-8 -top-8 h-28 w-28 rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgb(var(${net < 0 ? '--c-neg' : '--c-pos'}) / 0.16), transparent 70%)` }} />
          <p className="text-xs font-bold text-ink-2">جمع کل · طلب منهای بدهی</p>
          <div className="flex items-baseline gap-2 mt-1">
            <AmountText value={Math.abs(net)} suffix="" className={`text-[34px] leading-none font-black ${net < 0 ? 'text-neg' : net > 0 ? 'text-pos' : 'text-ink'}`} />
            <span className={`text-sm font-extrabold ${net < 0 ? 'text-neg' : net > 0 ? 'text-pos' : 'text-ink-2'}`}>{net < 0 ? 'تومان بدهکاری' : net > 0 ? 'تومان طلبکاری' : 'تومان — صاف'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 mt-4">
            <div className="rounded-2xl p-3 flex items-center gap-2.5" style={{ background: 'rgb(var(--c-pos) / 0.10)' }}>
              <span className="h-9 w-9 rounded-xl grid place-items-center text-white shrink-0" style={{ background: 'rgb(var(--c-pos))' }}><ArrowDownLeft size={18} /></span>
              <div className="min-w-0"><p className="text-[11px] font-bold text-ink-2">باید بگیری</p><p className="num text-base font-black text-pos leading-tight">{formatAmount(owed)}</p><p className="text-[10px] text-ink-2">{formatAmount(credits.length)} مورد</p></div>
            </div>
            <div className="rounded-2xl p-3 flex items-center gap-2.5" style={{ background: 'rgb(var(--c-neg) / 0.10)' }}>
              <span className="h-9 w-9 rounded-xl grid place-items-center text-white shrink-0" style={{ background: 'rgb(var(--c-neg))' }}><ArrowUpRight size={18} /></span>
              <div className="min-w-0"><p className="text-[11px] font-bold text-ink-2">بدهی‌ات</p><p className="num text-base font-black text-neg leading-tight">{formatAmount(owe)}</p><p className="text-[10px] text-ink-2">{formatAmount(debts.length)} مورد</p></div>
            </div>
          </div>
        </div>
      </Hero>

      <div className="px-5 mt-4 flex flex-col gap-5">
        {pendingForMe.length > 0 && (
          <button onClick={() => nav(`/g/${pendingForMe[0].groupId}?tab=settle`)} className="w-full rounded-2xl p-3.5 flex items-center gap-3 text-right text-[#1E1B18]" style={{ background: 'linear-gradient(135deg, #fde68a, #fbbf24)', boxShadow: '0 10px 26px -12px rgba(251,191,36,0.7)' }}>
            <span className="h-10 w-10 rounded-xl bg-white/50 grid place-items-center"><Clock size={18} /></span>
            <span className="flex-1 leading-tight"><span className="block text-sm font-black">{formatAmount(pendingForMe.length)} پرداخت منتظر تأیید توئه</span><span className="block text-[11px] font-semibold opacity-80 mt-0.5">یه نگاه بنداز و تأیید کن تا حساب صاف بشه</span></span>
            <ChevronLeft size={18} />
          </button>
        )}
        {rows.length === 0 && <Empty mood="happy" title="حساب همه صافه" text="هیچ بدهی یا طلبی نداری. وقتی هزینه‌ای ثبت بشه، این‌جا می‌بینی کی به کی چقدر بده." action={<button onClick={() => nav('/pick/expense')} className="btn-primary"><Receipt size={16} /> ثبت هزینه</button>} />}
        {debts.length > 0 && (
          <section>
            <h2 className="text-sm font-extrabold text-ink-2 mb-2 flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-neg" /> بدهی‌های من <span className="num text-neg">({formatAmount(owe)} تومان)</span></h2>
            <div className="flex flex-col gap-2.5">{debts.map((r, i) => <TransferCard key={r.g.group.id + r.t.to} g={r.g} t={r.t} me={me.id} index={i} showGroup onPay={(t) => setPay({ g: r.g, t })} onRemind={remind(r.g)} />)}</div>
          </section>
        )}
        {credits.length > 0 && (
          <section>
            <h2 className="text-sm font-extrabold text-ink-2 mb-2 flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-pos" /> طلب‌های من <span className="num text-pos">({formatAmount(owed)} تومان)</span></h2>
            <div className="flex flex-col gap-2.5">{credits.map((r, i) => <TransferCard key={r.g.group.id + r.t.from} g={r.g} t={r.t} me={me.id} index={i + 50} showGroup onPay={(t) => setPay({ g: r.g, t })} onRemind={remind(r.g)} />)}</div>
          </section>
        )}
      </div>
      {pay && <PaySheet t={pay.t} onClose={() => setPay(null)} g={pay.g} />}
    </motion.div>
  );
}
