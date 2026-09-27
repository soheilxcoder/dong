import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Home, Receipt, UserPlus, HandCoins, BellRing, Clock, ArrowLeft, Plus, Wallet } from 'lucide-react';
import { computeNetBalances, simplifyDebts, userBalance, formatAmount, pendingBetween } from '@dong/core';
import { useStore } from '@/app/store';
import { Avatar, AvatarStack, AmountText, BalanceChip, Empty } from '@/design-system/ui';
import { Mascot } from '@/design-system/Mascot';
import { fmtAgo } from '@/lib/date';

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
      <div className="px-5 -mt-3">
        {list.length === 0 ? (
          <Empty mood="waiting" title="هنوز گروهی نداری" text="اول یک گروه بساز؛ بعد از همین‌جا ادامه بده." action={<button onClick={() => nav('/new-group')} className="btn-primary"><Plus size={16} /> گروه جدید</button>} />
        ) : (
          <div className="flex flex-col gap-2.5">
            <p className="text-xs font-bold text-ink-2 px-1 mt-2">یک گروه انتخاب کن</p>
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
  const rows = useMemo(() => groups.flatMap((g) => {
    const balances = computeNetBalances(g.members.map((m) => m.userId), g.expenses, g.settlements);
    const transfers = simplifyDebts(balances).filter((t) => t.from === me.id || t.to === me.id);
    const name = (id: string) => g.members.find((m) => m.userId === id)?.user ?? null;
    return transfers.map((t) => ({ g, t, other: name(t.from === me.id ? t.to : t.from), iOwe: t.from === me.id, pend: pendingBetween(g.settlements, t.from, t.to) }));
  }), [groups, me.id]);
  const owe = rows.filter((r) => r.iOwe).reduce((s, r) => s + r.t.amount, 0);
  const owed = rows.filter((r) => !r.iOwe).reduce((s, r) => s + r.t.amount, 0);
  const net = owed - owe;
  const pendingForMe = groups.flatMap((g) => g.settlements).filter((s) => s.status === 'pending_confirmation' && s.toUser === me.id);
  const debts = rows.filter((r) => r.iOwe), credits = rows.filter((r) => !r.iOwe);

  const remind = async (r: typeof rows[number]) => {
    try { await adapter.sendReminder(r.g.group.id, r.t.from, r.t.amount); toast(`یادآوری برای ${r.other?.fullName ?? ''} ثبت شد`, 'ok'); } catch (e) { toast((e as Error).message, 'err'); }
  };

  const Row = ({ r, i }: { r: typeof rows[number]; i: number }) => {
    const remaining = Math.max(0, r.t.amount - r.pend);
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className={`card p-3.5 ${r.iOwe ? 'ring-1 ring-neg/30' : 'ring-1 ring-pos/30'}`}>
        <button onClick={() => nav(`/g/${r.g.group.id}?tab=settle`)} className="w-full flex items-center gap-3 text-right">
          <Avatar name={r.other?.fullName ?? 'حذف‌شده'} src={r.other?.avatarUrl} size={44} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-extrabold truncate">{r.iOwe ? <>به <span className="text-ink">{r.other?.fullName}</span> بدهکاری</> : <><span className="text-ink">{r.other?.fullName}</span> بهت بدهکاره</>}</p>
            <p className="text-[11px] text-ink-2 truncate mt-0.5 flex items-center gap-1"><span className="h-4 w-4 rounded-md inline-grid place-items-center text-[9px] text-white font-black" style={{ background: r.g.group.coverImageUrl ? `url(${r.g.group.coverImageUrl}) center/cover` : 'var(--grad-hero)' }}>{!r.g.group.coverImageUrl && r.g.group.name.charAt(0)}</span>{r.g.group.name}</p>
          </div>
          <div className="text-left shrink-0">
            <p className={`num text-lg font-black ${r.iOwe ? 'text-neg' : 'text-pos'}`}>{formatAmount(r.t.amount)}</p>
            <p className="text-[10px] text-ink-2">تومان</p>
          </div>
        </button>
        <div className="mt-3 flex items-center gap-2">
          {r.iOwe ? (
            remaining <= 0
              ? <span className="inline-flex items-center gap-1.5 rounded-full px-3 h-9 text-xs font-extrabold text-amber2" style={{ background: 'rgb(var(--c-amber) / 0.14)' }}><Clock size={14} /> در انتظار تأیید {r.other?.fullName}</span>
              : <button onClick={() => nav(`/g/${r.g.group.id}?tab=settle`)} className="btn-primary !min-h-9 text-xs px-4"><HandCoins size={15} /> {r.pend > 0 ? `پرداخت باقی‌مانده (${formatAmount(remaining)})` : 'پرداخت و ثبت رسید'}</button>
          ) : (
            <>
              {r.pend > 0 && <span className="inline-flex items-center gap-1.5 rounded-full px-3 h-9 text-xs font-extrabold text-amber2" style={{ background: 'rgb(var(--c-amber) / 0.14)' }}><Clock size={14} /> {formatAmount(r.pend)} منتظر تأیید توئه</span>}
              <button onClick={() => remind(r)} className="btn-ghost !min-h-9 text-xs px-3"><BellRing size={15} /> یادآوری</button>
            </>
          )}
          <span className="flex-1" />
          <button onClick={() => nav(`/g/${r.g.group.id}?tab=settle`)} className="text-[11px] font-bold text-ink-2 flex items-center gap-0.5">جزئیات <ChevronLeft size={14} /></button>
        </div>
      </motion.div>
    );
  };

  return (
    <motion.div className="min-h-dvh pb-32" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      <Hero title="تسویه‌حساب" sub={rows.length === 0 ? 'همه‌چیز صافه؛ دمت گرم' : net < 0 ? 'یه‌کم بدهی داری — الان صافش کن' : net > 0 ? 'طلبت رو یادآوری کن' : 'بدهی و طلبت برابره'} icon={<Wallet size={18} />} mood={rows.length === 0 ? 'happy' : net < 0 ? 'waiting' : 'idle'}>
        <div className="mt-5 glass rounded-card p-4 text-white" style={{ background: 'rgba(255,255,255,0.14)' }}>
          <p className="text-xs text-white/80">جمع کل (طلب منهای بدهی)</p>
          <AmountText value={net} className={`num text-3xl font-black ${net < 0 ? 'text-rose-200' : net > 0 ? 'text-emerald-100' : 'text-white'}`} />
          <div className="grid grid-cols-2 gap-2.5 mt-3">
            <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.14)' }}><p className="text-[11px] text-white/80 flex items-center gap-1"><ArrowLeft size={12} /> باید بگیری</p><p className="num text-lg font-black mt-0.5">{formatAmount(owed)} <span className="text-[10px] font-bold opacity-80">تومان</span></p><p className="text-[10px] text-white/70">{formatAmount(credits.length)} مورد</p></div>
            <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.14)' }}><p className="text-[11px] text-white/80 flex items-center gap-1"><ArrowLeft size={12} className="rotate-180" /> بدهی‌ات</p><p className="num text-lg font-black mt-0.5">{formatAmount(owe)} <span className="text-[10px] font-bold opacity-80">تومان</span></p><p className="text-[10px] text-white/70">{formatAmount(debts.length)} مورد</p></div>
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
            <div className="flex flex-col gap-2.5">{debts.map((r, i) => <Row key={r.g.group.id + r.t.to} r={r} i={i} />)}</div>
          </section>
        )}
        {credits.length > 0 && (
          <section>
            <h2 className="text-sm font-extrabold text-ink-2 mb-2 flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-pos" /> طلب‌های من <span className="num text-pos">({formatAmount(owed)} تومان)</span></h2>
            <div className="flex flex-col gap-2.5">{credits.map((r, i) => <Row key={r.g.group.id + r.t.from} r={r} i={i} />)}</div>
          </section>
        )}
      </div>
    </motion.div>
  );
}
