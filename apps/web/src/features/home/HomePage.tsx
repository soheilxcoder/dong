import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Sparkles, Bell, ChevronLeft, Link2, BadgeCheck } from 'lucide-react';
import { computeNetBalances, simplifyDebts, userBalance, formatAmount } from '@dong/core';
import { useStore } from '@/app/store';
import { fmtDate } from '@/lib/date';
import { AmountText, Avatar, AvatarStack, BalanceChip, Empty } from '@/design-system/ui';
import { Mascot } from '@/design-system/Mascot';
import type { GroupDetail } from '@/data/adapter';
import { fmtAgo } from '@/lib/date';
import { Tour } from '@/design-system/Tour';
import { showStartupAd } from '@/lib/ads';

export function useGroupSummary(g: GroupDetail, me: string) {
  return useMemo(() => {
    const ids = g.members.map((m) => m.userId);
    const balances = computeNetBalances(ids, g.expenses, g.settlements);
    const transfers = simplifyDebts(balances);
    const mine = userBalance(me, balances);
    const pendingForMe = g.settlements.filter((s) => s.status === 'pending_confirmation' && s.toUser === me).length;
    const last = g.expenses[0]?.createdAt ?? g.group.createdAt;
    const total = g.expenses.reduce((s, e) => s + e.totalAmount, 0);
    return { balances, transfers, mine, pendingForMe, last, total };
  }, [g, me]);
}

const dayMessage = (d: Date) => { const h = d.getHours(); return h < 5 ? 'هنوز بیداری؟ حساب‌ها منتظرن' : h < 11 ? 'صبح قشنگی داشته باشی' : h < 14 ? 'ظهر بخیر، وقت ناهاره' : h < 17 ? 'عصر دل‌چسبی داشته باشی' : h < 20 ? 'غروب آرومی داشته باشی' : 'شب آروم و بی‌دغدغه'; };
const isDev = () => localStorage.getItem('dong.dev') === '1';
function useClock() { const [d, setD] = useState(new Date()); useEffect(() => { const t = setInterval(() => setD(new Date()), 15000); return () => clearInterval(t); }, []); return d; }

export function HomePage() {
  // The one and only ad: shown once per launch, right after login / when home first appears.
  useEffect(() => { const t = setTimeout(() => { void showStartupAd(); }, 1200); return () => clearTimeout(t); }, []);
  const { user, groups, adapter, toast } = useStore();
  const nav = useNavigate();
  const [busyDemo, setBusyDemo] = useState(false);
  const clock = useClock();
  const me = user!;

  const summaries = groups.map((g) => {
    const ids = g.members.map((m) => m.userId);
    const balances = computeNetBalances(ids, g.expenses, g.settlements);
    const mine = userBalance(me.id, balances);
    const pendingForMe = g.settlements.filter((s) => s.status === 'pending_confirmation' && s.toUser === me.id).length;
    const last = g.expenses[0]?.createdAt ?? g.group.createdAt;
    const urgency = (pendingForMe ? 3 : 0) + (mine < 0 ? 2 : 0) + (mine > 0 ? 1 : 0);
    return { g, mine, pendingForMe, last, urgency };
  }).sort((a, b) => b.urgency - a.urgency || b.last.localeCompare(a.last));

  const total = summaries.reduce((s, x) => s + x.mine, 0);
  const owed = summaries.filter((x) => x.mine > 0).reduce((s, x) => s + x.mine, 0);
  const owe = summaries.filter((x) => x.mine < 0).reduce((s, x) => s - x.mine, 0);
  const pending = summaries.reduce((s, x) => s + x.pendingForMe, 0);

  const loadDemo = async () => { setBusyDemo(true); try { await adapter.loadDemo?.(); toast('گروه نمونه «سفر کیش» اضافه شد', 'ok'); } finally { setBusyDemo(false); } };

  return (
    <div className="safe-b">
      {/* Hero */}
      <div className="px-3" style={{ paddingTop: 'calc(var(--safe-top) + 10px)' }}>
        <div className="hero-ring">
          <div className="hero relative px-4 pt-3 pb-12 overflow-hidden">
            <div className="hero-blob hero-blob-a" /><div className="hero-blob hero-blob-b" />
            <div className="relative flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <Link to="/profile" className="ring-2 ring-white/40 rounded-full shrink-0"><Avatar name={me.fullName} src={me.avatarUrl} size={36} /></Link>
                <div className="leading-tight min-w-0">
                  <p className="text-white/75 text-[11px] font-semibold truncate">{dayMessage(clock)}</p>
                  <p className="text-white font-extrabold text-[15px] truncate">{me.fullName}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-white/90 text-[11px] font-bold bg-white/15 rounded-full px-2.5 py-1 num tabular-nums">{fmtDate(clock.toISOString(), 'EEEE d MMMM')} · {fmtDate(clock.toISOString(), 'HH:mm')}</span>
                {pending > 0 && (
                  <Link to="/activity" className="relative p-1.5 rounded-full bg-white/15 text-white"><Bell size={16} /><span className="absolute -top-1 -left-1 h-4 min-w-4 px-1 rounded-full bg-amber2 text-[#1E1B18] text-[10px] font-black grid place-items-center">{formatAmount(pending)}</span></Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Total balance glass card */}
      <motion.div data-tour="balance" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mx-5 -mt-9 glass rounded-card p-5 relative overflow-hidden" style={{ background: 'rgb(var(--c-surface) / 0.75)' }}>
        <p className="text-ink-2 text-sm font-semibold">وضعیت کلی شما</p>
        <div className="mt-1 flex items-baseline gap-2">
          <AmountText value={Math.abs(total)} className={`text-4xl font-black ${total > 0 ? 'text-pos' : total < 0 ? 'text-neg' : 'text-ink'}`} suffix="" />
          <span className="text-ink-2 font-bold">تومان</span>
        </div>
        <p className={`text-sm font-bold mt-1 flex items-center gap-1.5 ${total > 0 ? 'text-pos' : total < 0 ? 'text-neg' : 'text-pos'}`}>
          {total > 0 ? 'در مجموع طلبکاری' : total < 0 ? 'در مجموع بدهکاری' : <><BadgeCheck size={16} /> حسابت صافه</>}
        </p>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-2xl bg-pos/10 p-3"><p className="text-xs text-ink-2">باید بگیری</p><p className="num font-extrabold text-pos mt-0.5">{formatAmount(owed)}</p></div>
          <div className="rounded-2xl bg-neg/10 p-3"><p className="text-xs text-ink-2">بدهی‌ات</p><p className="num font-extrabold text-neg mt-0.5">{formatAmount(owe)}</p></div>
        </div>
        <div className="absolute -left-4 -top-4 opacity-[0.07] pointer-events-none"><Mascot mood="idle" size={110} /></div>
      </motion.div>

      {/* Groups bento */}
      <div className="px-5 mt-7 flex items-center justify-between">
        <h2 className="text-lg font-extrabold">گروه‌ها</h2>
        {isDev() && groups.length > 0 && !groups.some((g) => g.group.name === 'سفر کیش') && (
          <button onClick={loadDemo} disabled={busyDemo} className="text-xs font-bold text-brand flex items-center gap-1"><Sparkles size={14} /> گروه نمونه</button>
        )}
      </div>

      <div className="px-5 mt-3">
        <button data-tour="join" onClick={() => nav('/join/paste')} className="w-full card p-3.5 flex items-center gap-3 text-right">
          <span className="h-10 w-10 rounded-2xl bg-brand/15 text-brand grid place-items-center"><Link2 size={18} /></span>
          <div className="flex-1"><p className="text-sm font-bold">لینک دعوت داری؟</p><p className="text-xs text-ink-2">لینک یا کد گروه را بچسبان و عضو شو</p></div>
        </button>
      </div>
      {groups.length === 0 ? (
        <Empty mood="waiting" title="هنوز گروهی نداری" text="یک گروه بساز و دوستات رو با لینک یا QR دعوت کن؛ از همون لحظه هزینه‌ها رو ثبت کنید."
          action={<div className="flex gap-2"><button onClick={() => nav('/new-group')} className="btn-primary">گروه جدید</button>{isDev() && <button onClick={loadDemo} disabled={busyDemo} className="btn-ghost"><Sparkles size={16} /> نمونه</button>}</div>} />
      ) : (
        <div className="px-5 mt-3 flex flex-col gap-2.5">
          {summaries.map(({ g, mine, pendingForMe, last }, i) => (
            <motion.button key={g.group.id} layoutId={`g-${g.group.id}`} onClick={() => nav(`/g/${g.group.id}`)}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="card text-right p-3 flex items-center gap-3 relative overflow-hidden">
              <span className="absolute inset-y-0 right-0 w-1" style={{ background: mine > 0 ? 'rgb(var(--c-pos))' : mine < 0 ? 'rgb(var(--c-neg))' : 'var(--grad-brand)' }} />
              <div className="h-12 w-12 rounded-2xl shrink-0 overflow-hidden grid place-items-center text-white font-black text-lg shadow-md"
                style={{ background: g.group.coverImageUrl ? `url(${g.group.coverImageUrl}) center/cover` : 'var(--grad-hero)' }}>
                {!g.group.coverImageUrl && g.group.name.trim().charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="font-extrabold truncate text-[15px]">{g.group.name}</h3>
                  {pendingForMe > 0 && <span className="chip bg-amber2/15 text-amber2 shrink-0 !py-0.5">{formatAmount(pendingForMe)} تأیید</span>}
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <AvatarStack names={g.members.map((m) => ({ name: m.user.fullName, src: m.user.avatarUrl }))} size={20} max={4} />
                  <span className="text-[11px] text-ink-2">· {fmtAgo(last)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <BalanceChip value={mine} />
                <ChevronLeft size={16} className="text-ink-2/50" />
              </div>
            </motion.button>
          ))}
        </div>
      )}
      <Tour id="home" steps={[
        { title: 'به دُنگ خوش اومدی!', text: 'اینجا خلاصه کل حساب‌کتابت رو می‌بینی: چقدر طلب داری و چقدر بدهی. روی هر گروه بزن تا جزئیاتش رو ببینی.', target: 'balance', mood: 'happy' },
        { title: 'گروه بساز', text: 'برای هر سفر یا دورهمی یک گروه بساز و دوستات رو با لینک یا QR دعوت کن.', target: 'fab' },
        { title: 'دعوت شدی؟', text: 'اگر کسی لینک دعوت فرستاده، همین‌جا بچسبون یا مستقیم لینک رو باز کن تا عضو گروه بشی.', target: 'join' },
        { title: 'همه‌چیز خودکار همگام می‌شه', text: 'وقتی کسی هزینه‌ای ثبت کنه، روی گوشی همه اعضا ظاهر می‌شه — رمزنگاری‌شده. پایین صفحه هم سه تب داری: خانه، فعالیت‌ها (همه اتفاقات و پرداخت‌های منتظر تأیید) و پروفایل (شماره کارت، تم، راهنما).', mood: 'happy' },
      ]} />
      {/* FAB */}
      <motion.button data-tour="fab" whileTap={{ scale: 0.92 }} onClick={() => nav('/new-group')} aria-label="گروه جدید"
        className="fab-ring fixed left-5 bottom-[calc(var(--safe-bottom)+96px)] z-40 h-14 w-14 rounded-full">
        <span className="h-full w-full rounded-full grid place-items-center text-white" style={{ background: 'var(--grad-celebrate)' }}><Plus size={26} strokeWidth={2.5} /></span>
      </motion.button>
    </div>
  );
}
