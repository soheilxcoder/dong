import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Plus, UserPlus, MoreVertical, Receipt, Trash2, Pencil, LogOut, Image as ImageIcon, Share2 } from 'lucide-react';
import type { Activity, Expense } from '@dong/core';
import { computeNetBalances, simplifyDebts, userBalance, formatAmount } from '@dong/core';
import { useStore } from '@/app/store';
import { Avatar, AvatarStack, BalanceChip, Empty, Sheet, CopyButton } from '@/design-system/ui';
import { ActivityList } from './ActivityList';
import { SettleTab } from '@/features/settlements/SettleTab';
import { fmtDate } from '@/lib/date';
import { shareText, compressImage, haptic } from '@/lib/native';
import { formatCardNumber } from '@dong/core';
import { Tour } from '@/design-system/Tour';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

type Tab = 'expenses' | 'settle' | 'members' | 'activity';

export function GroupPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { user, groups, adapter, toast, syncStatus, refresh } = useStore();
  const g = groups.find((x) => x.group.id === id);
  const [tab, setTab] = useState<Tab>('expenses');
  const [menu, setMenu] = useState(false);
  const [viewExpense, setViewExpense] = useState<Expense | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);

  useEffect(() => { if (tab === 'activity' && g) adapter.activity(g.group.id).then(setActivity); }, [tab, g, adapter]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (adapter.kind === 'api') refresh().catch(() => {}); }, [tab]);

  const calc = useMemo(() => {
    if (!g) return null;
    const ids = g.members.map((m) => m.userId);
    const balances = computeNetBalances(ids, g.expenses, g.settlements);
    return { balances, transfers: simplifyDebts(balances), mine: userBalance(user!.id, balances), total: g.expenses.reduce((s, e) => s + e.totalAmount, 0) };
  }, [g, user]);

  if (!g || !calc) return <div className="min-h-dvh grid place-items-center text-ink-2">گروه پیدا نشد</div>;
  const me = user!;
  const name = (uid: string) => g.members.find((m) => m.userId === uid)?.user.fullName ?? 'حذف‌شده';
  const isOwner = g.members.find((m) => m.userId === me.id)?.role === 'owner';
  const pendingCount = g.settlements.filter((s) => s.status === 'pending_confirmation').length;

  const tabs: { v: Tab; l: string; badge?: number }[] = [
    { v: 'expenses', l: 'هزینه‌ها' },
    { v: 'settle', l: 'تسویه‌حساب', badge: pendingCount || undefined },
    { v: 'members', l: 'اعضا' },
    { v: 'activity', l: 'فعالیت' },
  ];

  const shareSummary = () => {
    const lines = calc.transfers.length ? calc.transfers.map((t) => `• ${name(t.from)} ⟶ ${name(t.to)}: ${formatAmount(t.amount)} تومان`).join('\n') : 'همه تسویه‌ان 🎉';
    shareText(`تسویه «${g.group.name}»`, `📊 تسویه‌حساب گروه «${g.group.name}» (دُنگ)\nجمع هزینه‌ها: ${formatAmount(calc.total)} تومان\n\n${lines}`);
  };

  return (
    <div className="min-h-dvh pb-32">
      {/* Parallax header */}
      <motion.div layoutId={`g-${g.group.id}`} className="relative h-56 overflow-hidden curve-bottom grain">
        <div className="absolute inset-0" style={{ background: g.group.coverImageUrl ? `url(${g.group.coverImageUrl}) center/cover` : 'var(--grad-hero)' }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/20" />
        <div className="relative h-full flex flex-col justify-between p-4" style={{ paddingTop: 'calc(var(--safe-top) + 12px)' }}>
          <div className="flex items-center justify-between text-white">
            <button onClick={() => nav('/')} className="p-2 rounded-full bg-white/15" aria-label="بازگشت"><ChevronRight size={22} /></button>
            <div className="flex gap-2 items-center">
              {(g.group.syncKey || adapter.kind === 'api') && (
                <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-full bg-white/15" title="همگام‌سازی">
                  {syncStatus === 'online' ? <Wifi size={14} className="text-pos" /> : syncStatus === 'error' ? <WifiOff size={14} className="text-neg" /> : <Loader2 size={14} className="animate-spin" />}
                  {syncStatus === 'online' ? 'همگام' : syncStatus === 'error' ? 'آفلاین' : 'اتصال…'}
                </span>
              )}
              <button onClick={shareSummary} className="p-2 rounded-full bg-white/15" aria-label="اشتراک خلاصه"><Share2 size={20} /></button>
              <button onClick={() => setMenu(true)} className="p-2 rounded-full bg-white/15" aria-label="منو"><MoreVertical size={20} /></button>
            </div>
          </div>
          <div className="text-white">
            <h1 className="text-2xl font-black drop-shadow">{g.group.name}</h1>
            <div className="flex items-center justify-between mt-2">
              <button data-tour="avatars" onClick={() => nav(`/g/${id}/invite`)}><AvatarStack names={g.members.map((m) => ({ name: m.user.fullName, src: m.user.avatarUrl }))} size={30} /></button>
              <BalanceChip value={calc.mine} />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="sticky top-0 z-20 px-4 pt-2 pb-1" style={{ background: 'rgb(var(--c-bg) / 0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', paddingTop: 'calc(var(--safe-top) + 8px)' }}>
        <div className="flex gap-1 border-b border-line/10 relative">
          {tabs.map((t) => (
            <button key={t.v} data-tour={`tab-${t.v}`} onClick={() => setTab(t.v)} className={`relative flex-1 py-2.5 text-sm font-bold ${tab === t.v ? 'text-brand' : 'text-ink-2'}`}>
              {t.l}{t.badge ? <span className="mr-1 inline-grid place-items-center h-4 min-w-4 px-1 rounded-full bg-amber2 text-[#1E1B18] text-[10px]">{formatAmount(t.badge)}</span> : null}
              {tab === t.v && <motion.span layoutId="tab-ul" className="absolute bottom-0 inset-x-3 h-0.5 rounded-full bg-brand" />}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-3">
        {tab === 'expenses' && (
          g.expenses.length === 0 ? (
            <Empty mood="waiting" title="هنوز هزینه‌ای ثبت نشده" text="بزن بریم اولین هزینه رو ثبت کنیم!" action={<button onClick={() => nav(`/g/${id}/expense/new`)} className="btn-primary"><Plus size={18} /> ثبت هزینه</button>} />
          ) : (
            <>
              <div className="card p-4 mb-3 flex items-center justify-between">
                <div><p className="text-xs text-ink-2">جمع هزینه‌های گروه</p><p className="num text-xl font-black mt-0.5">{formatAmount(calc.total)} <span className="text-sm font-bold text-ink-2">تومان</span></p></div>
                <div className="text-left"><p className="text-xs text-ink-2">تعداد</p><p className="num font-extrabold">{formatAmount(g.expenses.length)}</p></div>
              </div>
              <ul className="flex flex-col gap-2">
                {g.expenses.map((e, i) => {
                  const myShare = e.participants.find((p) => p.userId === me.id)?.amountOwed ?? 0;
                  const iPaid = e.paidBy === me.id;
                  return (
                    <motion.li key={e.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }}>
                      <button onClick={() => setViewExpense(e)} className="card w-full p-3.5 flex items-center gap-3 text-right">
                        <Avatar name={name(e.paidBy)} size={42} />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold truncate">{e.title}</p>
                          <p className="text-xs text-ink-2 mt-0.5">{name(e.paidBy)} حساب کرد · {fmtDate(e.paidAt)} · {formatAmount(e.participants.length)} نفر</p>
                        </div>
                        <div className="text-left shrink-0">
                          <p className="num font-extrabold">{formatAmount(e.totalAmount)}</p>
                          <p className={`text-[11px] font-bold ${iPaid ? 'text-pos' : myShare ? 'text-neg' : 'text-neutral2'}`}>{iPaid ? `طلب ${formatAmount(e.totalAmount - myShare)}` : myShare ? `سهم من ${formatAmount(myShare)}` : 'نبودم'}</p>
                        </div>
                      </button>
                    </motion.li>
                  );
                })}
              </ul>
            </>
          )
        )}
        {tab === 'settle' && <SettleTab g={g} balances={calc.balances} transfers={calc.transfers} />}
        {tab === 'members' && (
          <div className="flex flex-col gap-2">
            <button onClick={() => nav(`/g/${id}/invite`)} className="btn-ghost w-full"><UserPlus size={18} /> دعوت / افزودن عضو</button>
            {g.members.map((m) => {
              const b = userBalance(m.userId, calc.balances);
              return (
                <div key={m.id} className="card p-3.5 flex items-center gap-3">
                  <Avatar name={m.user.fullName} src={m.user.avatarUrl} size={44} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{m.user.fullName} {m.userId === me.id && <span className="text-xs text-ink-2">(من)</span>} {m.role === 'owner' && <span className="chip bg-amber2/15 text-amber2 mr-1">مالک</span>}</p>
                    {m.user.cardNumber ? <p className="mono text-[11px] text-ink-2 mt-0.5 whitespace-nowrap" dir="ltr" style={{ letterSpacing: "0.05em" }}>{formatCardNumber(m.user.cardNumber)}</p> : <p className="text-[11px] text-ink-2 mt-0.5">شماره کارت ثبت نشده</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <BalanceChip value={b} />
                    {m.user.cardNumber && <CopyButton text={m.user.cardNumber} label="کپی شماره کارت" small />}
                  </div>
                  {isOwner && m.userId !== me.id && (
                    <button onClick={async () => { if (!confirm(`«${m.user.fullName}» از گروه حذف شود؟`)) return; try { await adapter.removeMember(g.group.id, m.userId); toast('حذف شد'); } catch (e) { toast((e as Error).message, 'err'); } }} className="p-2 text-ink-2" aria-label="حذف"><Trash2 size={16} /></button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {tab === 'activity' && (activity.length ? <ActivityList items={activity} /> : <Empty mood="waiting" title="هنوز فعالیتی نیست" />)}
      </div>

      {/* FAB */}
      <Tour id="group" delay={700} steps={[
        { title: 'صفحه گروه', text: 'با زدن روی آواتارها، اعضا رو دعوت یا اضافه کن. هر کسی با لینک دعوت عضو شه، خودکار همگام می‌شه.', target: 'avatars' },
        { title: 'ثبت هزینه', text: 'هر بار کسی حساب کرد، همین‌جا ثبتش کن و فقط کسایی که بودن رو انتخاب کن.', target: 'fab-expense', mood: 'happy' },
        { title: 'تسویه‌حساب', text: 'اینجا دُنگ می‌گه دقیقاً کی به کی چقدر بده — با کمترین تعداد تراکنش. شماره کارت هم همون‌جا قابل کپیه.', target: 'tab-settle' },
        { title: 'شفافیت کامل', text: 'همه اتفاقات گروه (هزینه، ویرایش، پرداخت، تأیید) در تب فعالیت ثبت می‌شه تا هیچ‌کس گیج نشه.', target: 'tab-activity' },
      ]} />
      <motion.button data-tour="fab-expense" whileTap={{ scale: 0.92 }} onClick={() => nav(`/g/${id}/expense/new`)}
        className="fixed left-5 bottom-[calc(var(--safe-bottom)+24px)] z-40 h-14 pl-5 pr-4 rounded-full flex items-center gap-2 text-white font-extrabold shadow-2xl" style={{ background: 'var(--grad-brand)' }}>
        <Plus size={24} strokeWidth={2.5} /> ثبت هزینه
      </motion.button>

      {/* Menu */}
      <Sheet open={menu} onClose={() => setMenu(false)} title={g.group.name}>
        <div className="flex flex-col gap-2 pb-2">
          <button className="btn-ghost justify-start" onClick={() => { setMenu(false); nav(`/g/${id}/invite`); }}><UserPlus size={18} /> دعوت اعضا</button>
          <button className="btn-ghost justify-start" onClick={shareSummary}><Share2 size={18} /> اشتراک‌گذاری خلاصه تسویه</button>
          <label className="btn-ghost justify-start cursor-pointer"><ImageIcon size={18} /> {g.group.coverImageUrl ? 'تغییر عکس گروه' : 'افزودن عکس گروه'}
            <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const url = await compressImage(f, 'cover'); await adapter.updateGroup(g.group.id, { coverImageUrl: url }); await refresh(); haptic('success'); toast('عکس گروه به‌روز شد', 'ok'); } catch { toast('آپلود عکس ناموفق بود', 'err'); } setMenu(false); }} />
          </label>
          {g.group.coverImageUrl && <button className="btn-ghost justify-start" onClick={async () => { await adapter.updateGroup(g.group.id, { coverImageUrl: null }); await refresh(); setMenu(false); }}><Trash2 size={18} /> حذف عکس گروه</button>}
          {adapter.kind === 'local' && <button className="btn-ghost justify-start" onClick={async () => { const s = await adapter.exportSnapshot!(g.group.id); const { inviteUrl } = await import('./InvitePage'); await shareText('به‌روزرسانی گروه دُنگ', `آخرین وضعیت گروه «${g.group.name}» — این لینک رو باز کن تا هزینه‌ها همگام بشه:`, inviteUrl(g.group.inviteToken, s)); setMenu(false); }}><Share2 size={18} /> ارسال لینک همگام‌سازی به اعضا</button>}
          <button className="btn-ghost justify-start text-neg" onClick={async () => { try { await adapter.leaveGroup(g.group.id); toast('از گروه خارج شدی'); nav('/'); } catch (e) { toast((e as Error).message, 'err'); } }}><LogOut size={18} /> خروج از گروه</button>
        </div>
      </Sheet>

      {/* Expense detail */}
      <Sheet open={!!viewExpense} onClose={() => setViewExpense(null)} title={viewExpense?.title}>
        {viewExpense && (
          <div className="pb-2">
            <div className="flex items-center gap-3 mb-4">
              <Avatar name={name(viewExpense.paidBy)} size={48} />
              <div><p className="text-sm text-ink-2">{name(viewExpense.paidBy)} حساب کرد · {fmtDate(viewExpense.paidAt, 'd MMMM yyyy')}</p><p className="num text-2xl font-black">{formatAmount(viewExpense.totalAmount)} <span className="text-sm text-ink-2 font-bold">تومان</span></p></div>
            </div>
            {viewExpense.notes && <p className="text-sm text-ink-2 bg-surface-2 rounded-2xl p-3 mb-3 leading-6">{viewExpense.notes}</p>}
            {viewExpense.receiptImageUrl && <img src={viewExpense.receiptImageUrl} className="rounded-2xl w-full max-h-72 object-contain bg-surface-2 mb-3" alt="فاکتور" />}
            <p className="label">سهم هر نفر</p>
            <ul className="flex flex-col gap-1.5">
              {viewExpense.participants.map((p) => (
                <li key={p.userId} className="flex items-center gap-3 bg-surface-2 rounded-2xl p-2.5"><Avatar name={name(p.userId)} size={32} /><span className="flex-1 font-semibold text-sm">{name(p.userId)}</span><span className="num font-extrabold">{formatAmount(p.amountOwed)}</span></li>
              ))}
            </ul>
            {(viewExpense.createdBy === me.id || isOwner) && (
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button className="btn-ghost" onClick={() => { setViewExpense(null); nav(`/g/${id}/expense/${viewExpense.id}`); }}><Pencil size={16} /> ویرایش</button>
                <button className="btn-ghost text-neg" onClick={async () => { if (!confirm('این هزینه حذف شود؟')) return; try { await adapter.deleteExpense(viewExpense.id); setViewExpense(null); toast('حذف شد'); } catch (e) { toast((e as Error).message, 'err'); } }}><Trash2 size={16} /> حذف</button>
              </div>
            )}
            {!viewExpense.receiptImageUrl && <p className="text-[11px] text-ink-2 mt-3 flex items-center gap-1"><ImageIcon size={12} /> فاکتوری ضمیمه نشده</p>}
            <span className="hidden"><Receipt /></span>
          </div>
        )}
      </Sheet>
    </div>
  );
}
