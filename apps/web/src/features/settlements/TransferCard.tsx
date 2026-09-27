import { motion } from 'framer-motion';
import { ArrowLeft, BellRing, Clock, HandCoins, Receipt } from 'lucide-react';
import type { Transfer } from '@dong/core';
import { formatAmount, formatCardNumber, detectBank, pendingBetween } from '@dong/core';
import { Avatar, CopyButton } from '@/design-system/ui';
import type { GroupDetail } from '@/data/adapter';

/** What a debt is for: expenses paid by the creditor that the debtor took part in (unsettled group view). */
export function debtReasons(g: GroupDetail, from: string, to: string, max = 3) {
  const direct = g.expenses.filter((e) => e.paidBy === to && e.participants.some((p) => p.userId === from && p.amountOwed > 0));
  const list = (direct.length ? direct : g.expenses.filter((e) => e.participants.some((p) => p.userId === from && p.amountOwed > 0)))
    .slice()
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  const titles = list.slice(0, max).map((e) => e.title);
  return { titles, more: Math.max(0, list.length - max), indirect: !direct.length && list.length > 0 };
}

export function TransferCard({ g, t, me, onPay, onRemind, index = 0, showGroup = false }: {
  g: GroupDetail; t: Transfer; me: string; onPay: (t: Transfer) => void; onRemind: (t: Transfer) => void; index?: number; showGroup?: boolean;
}) {
  const member = (id: string) => g.members.find((m) => m.userId === id)?.user;
  const name = (id: string) => member(id)?.fullName ?? 'حذف‌شده';
  const cred = member(t.to);
  const iOwe = t.from === me; const iGet = t.to === me;
  const bank = cred?.cardNumber ? detectBank(cred.cardNumber) : null;
  const pend = pendingBetween(g.settlements, t.from, t.to); const remaining = Math.max(0, t.amount - pend);
  const canPay = iOwe || member(t.from)?.username.startsWith('local_') || member(t.from)?.username.startsWith('demo_');
  const why = debtReasons(g, t.from, t.to);
  return (
    <motion.div data-tour={index === 0 ? 'transfer' : undefined} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}
      className={`card p-4 ${iOwe ? 'ring-1 ring-neg/40' : iGet ? 'ring-1 ring-pos/40' : ''}`}>
      {showGroup && (
        <div className="flex items-center gap-1.5 mb-3 text-[11px] font-bold text-ink-2">
          <span className="h-5 w-5 rounded-md grid place-items-center text-[10px] text-white font-black" style={{ background: g.group.coverImageUrl ? `url(${g.group.coverImageUrl}) center/cover` : 'var(--grad-hero)' }}>{!g.group.coverImageUrl && g.group.name.trim().charAt(0)}</span>
          {g.group.name}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col items-center gap-1 w-[84px]"><Avatar name={name(t.from)} src={member(t.from)?.avatarUrl} size={44} /><span className="text-xs font-bold w-full text-center leading-tight name-2l">{name(t.from)}</span></div>
        <div className="flex-1 flex flex-col items-center">
          <p className="num text-xl font-black">{formatAmount(t.amount)}</p>
          <div className="flex items-center gap-0.5 text-brand mt-0.5">
            {[0, 1, 2].map((k) => <ArrowLeft key={k} size={16} className="animate-pulseArrow" style={{ animationDelay: `${k * 0.2}s` }} />)}
          </div>
          <p className="text-[11px] text-ink-2">تومان</p>
        </div>
        <div className="flex flex-col items-center gap-1 w-[84px]"><Avatar name={name(t.to)} src={cred?.avatarUrl} size={44} /><span className="text-xs font-bold w-full text-center leading-tight name-2l">{name(t.to)}</span></div>
      </div>

      {/* بابت */}
      {why.titles.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-2xl px-3 py-2 bg-surface-2">
          <span className="h-6 w-6 rounded-lg grid place-items-center shrink-0 text-brand" style={{ background: 'rgb(var(--c-brand) / 0.12)' }}><Receipt size={13} /></span>
          <p className="text-[12px] leading-6 min-w-0">
            <span className="font-extrabold text-ink">بابت{why.indirect ? ' هزینه‌های گروه' : ''}: </span>
            <span className="text-ink-2 font-semibold">{why.titles.join('، ')}{why.more > 0 ? ` و ${formatAmount(why.more)} مورد دیگر` : ''}</span>
          </p>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {cred?.cardNumber ? (
          <div className="flex items-center gap-2 bg-surface-2 rounded-full pr-3 pl-1 py-1">
            {bank && <span className="h-2.5 w-2.5 rounded-full" style={{ background: bank.color }} title={bank.name} />}
            <span className="mono text-xs font-bold">{formatCardNumber(cred.cardNumber)}</span>
            <CopyButton text={cred.cardNumber} label="کپی شماره کارت" small />
          </div>
        ) : <span className="text-[11px] text-ink-2">شماره کارت ثبت نشده — از طریق پیام هماهنگ کنید</span>}
        <span className="flex-1" />
        {canPay && (
          remaining <= 0
            ? <span className="inline-flex items-center gap-1.5 rounded-full px-3 h-10 text-xs font-extrabold text-amber2" style={{ background: 'rgb(var(--c-amber) / 0.14)' }}><Clock size={14} /> در انتظار تأیید {name(t.to)}</span>
            : <button onClick={() => onPay({ ...t, amount: remaining })} className="btn-primary !min-h-10 text-sm px-4"><HandCoins size={16} /> {pend > 0 ? `ثبت باقی‌مانده (${formatAmount(remaining)})` : 'ثبت پرداخت'}</button>
        )}
        {iGet && (
          <>
            {pend > 0 && <span className="inline-flex items-center gap-1.5 rounded-full px-3 h-10 text-xs font-extrabold text-amber2" style={{ background: 'rgb(var(--c-amber) / 0.14)' }}><Clock size={14} /> {formatAmount(pend)} منتظر تأیید توئه</span>}
            <button onClick={() => onRemind(t)} className="btn-ghost !min-h-10 text-sm px-3"><BellRing size={16} /> یادآوری</button>
          </>
        )}
      </div>
    </motion.div>
  );
}
