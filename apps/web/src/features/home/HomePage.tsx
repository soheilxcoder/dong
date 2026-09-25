import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Sparkles, Bell, ChevronLeft, Link2 } from 'lucide-react';
import { computeNetBalances, simplifyDebts, userBalance, formatAmount } from '@dong/core';
import { useStore } from '@/app/store';
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

export function HomePage() {
  // The one and only ad: shown once per launch, right after login / when home first appears.
  useEffect(() => { const t = setTimeout(() => { void showStartupAd(); }, 1200); return () => clearTimeout(t); }, []);
  const { user, groups, adapter, toast } = useStore();
  const nav = useNavigate();
  const [busyDemo, setBusyDemo] = useState(false);
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
      <div className="curve-bottom grain relative px-5 pb-16" style={{ background: 'var(--grad-hero)', paddingTop: 'calc(var(--safe-top) + 20px)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/profile"><Avatar name={me.fullName} src={me.avatarUrl} size={44} /></Link>
            <p className="text-white font-extrabold">{me.fullName}</p>
          </div>
          {pending > 0 && (
            <Link to="/activity" className="relative p-2.5 rounded-full bg-white/10 text-white"><Bell size={20} /><span className="absolute -top-0.5 -left-0.5 h-5 min-w-5 px-1 rounded-full bg-amber2 text-[#1E1B18] text-[10px] font-black grid place-items-center">{formatAmount(pending)}</span></Link>
          )}
        </div>
      </div>

      {/* Total balance glass card */}
      <motion.div data-tour="balance" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mx-5 -mt-12 glass rounded-card p-5 relative overflow-hidden" style={{ background: 'rgb(var(--c-surface) / 0.75)' }}>
        <p className="text-ink-2 text-sm font-semibold">وضعیت کلی شما</p>
        <div className="mt-1 flex items-baseline gap-2">
          <AmountText value={Math.abs(total)} className={`text-4xl font-black ${total > 0 ? 'text-pos' : total < 0 ? 'text-neg' : 'text-ink'}`} suffix="" />
          <span className="text-ink-2 font-bold">تومان</span>
        </div>
        <p className={`text-sm font-bold mt-1 ${total > 0 ? 'text-pos' : total < 0 ? 'text-neg' : 'text-neutral2'}`}>
          {total > 0 ? 'در مجموع طلبکاری' : total < 0 ? 'در مجموع بدهکاری' : 'صاف صافی 🎉'}
        </p>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-2xl bg-pos/10 p-3"><p className="text-xs text-ink-2">باید بگیری</p><p className="num font-extrabold text-pos mt-0.5">{formatAmount(owed)}</p></div>
          <div className="rounded-2xl bg-neg/10 p-3"><p className="text-xs text-ink-2">باید بدی</p><p className="num font-extrabold text-neg mt-0.5">{formatAmount(owe)}</p></div>
        </div>
        <div className="absolute -left-4 -top-4 opacity-[0.07] pointer-events-none"><Mascot mood="idle" size={110} /></div>
      </motion.div>

      {/* Groups bento */}
      <div className="px-5 mt-7 flex items-center justify-between">
        <h2 className="text-lg font-extrabold">گروه‌ها</h2>
        {groups.length > 0 && !groups.some((g) => g.group.name === 'سفر کیش') && (
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
        <Empty mood="waiting" title="هنوز گروهی نداری" text="یک گروه بساز و دوستات رو دعوت کن، یا برای دیدن امکانات، گروه نمونه «سفر کیش» رو بارگذاری کن."
          action={<div className="flex gap-2"><button onClick={() => nav('/new-group')} className="btn-primary">گروه جدید</button><button onClick={loadDemo} disabled={busyDemo} className="btn-ghost"><Sparkles size={16} /> نمونه</button></div>} />
      ) : (
        <div className="px-5 mt-3 grid grid-cols-2 gap-3">
          {summaries.map(({ g, mine, pendingForMe, last, urgency }, i) => {
            const big = i === 0 || urgency >= 2;
            return (
              <motion.button key={g.group.id} layoutId={`g-${g.group.id}`} onClick={() => nav(`/g/${g.group.id}`)}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`card text-right p-4 flex flex-col justify-between relative overflow-hidden ${big ? 'col-span-2 min-h-36' : 'min-h-36'}`}>
                {g.group.coverImageUrl && <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(to left, rgb(var(--c-surface) / 0.25), rgb(var(--c-surface)) 55%), url(${g.group.coverImageUrl}) left center / cover no-repeat` }} />}
                <div className="relative flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-extrabold truncate text-base">{g.group.name}</h3>
                    <p className="text-xs text-ink-2 mt-0.5">{fmtAgo(last)}</p>
                  </div>
                  {pendingForMe > 0 && <span className="chip bg-amber2/15 text-amber2 shrink-0">{formatAmount(pendingForMe)} تأیید</span>}
                </div>
                <div className={`relative flex items-end justify-between mt-3 ${big ? '' : 'flex-col items-start gap-2'}`}>
                  <AvatarStack names={g.members.map((m) => ({ name: m.user.fullName, src: m.user.avatarUrl }))} size={big ? 30 : 26} max={big ? 6 : 3} />
                  <BalanceChip value={mine} />
                </div>
                {big && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-2/40"><ChevronLeft /></span>}
              </motion.button>
            );
          })}
        </div>
      )}

      <Tour id="home" steps={[
        { title: 'به دُنگ خوش اومدی!', text: 'اینجا خلاصه کل حساب‌کتابت رو می‌بینی: چقدر باید بگیری و چقدر باید بدی.', target: 'balance', mood: 'happy' },
        { title: 'گروه بساز', text: 'برای هر سفر یا دورهمی یک گروه بساز و دوستات رو با لینک یا QR دعوت کن.', target: 'fab' },
        { title: 'دعوت شدی؟', text: 'اگر کسی لینک دعوت فرستاده، همین‌جا بچسبون یا مستقیم لینک رو باز کن تا عضو گروه بشی.', target: 'join' },
        { title: 'همه‌چیز خودکار همگام می‌شه', text: 'وقتی کسی هزینه‌ای ثبت کنه، روی گوشی همه اعضا ظاهر می‌شه — بدون ثبت‌نام اضافه، رمزنگاری‌شده.', mood: 'happy' },
      ]} />
      {/* FAB */}
      <motion.button data-tour="fab" whileTap={{ scale: 0.92 }} onClick={() => nav('/new-group')} aria-label="گروه جدید"
        className="fixed left-5 bottom-[calc(var(--safe-bottom)+92px)] z-40 h-16 w-16 rounded-full grid place-items-center text-white shadow-2xl"
        style={{ background: 'var(--grad-celebrate)' }}>
        <Plus size={30} strokeWidth={2.5} />
      </motion.button>
    </div>
  );
}
