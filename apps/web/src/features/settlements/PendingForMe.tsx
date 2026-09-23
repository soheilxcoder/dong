import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { formatAmount } from '@dong/core';
import { useStore } from '@/app/store';
import { Avatar } from '@/design-system/ui';

/** Cross-group list of settlements waiting for my confirmation. */
export function PendingForMe() {
  const { user, groups } = useStore();
  const items = groups.flatMap((g) => g.settlements.filter((s) => s.status === 'pending_confirmation' && s.toUser === user!.id).map((s) => ({ s, g })));
  if (!items.length) return null;
  return (
    <section className="mb-4">
      <h3 className="text-sm font-extrabold text-ink-2 mb-2 flex items-center gap-1"><Clock size={14} /> منتظر تأیید شما</h3>
      <div className="flex flex-col gap-2">
        {items.map(({ s, g }) => {
          const from = g.members.find((m) => m.userId === s.fromUser)?.user.fullName ?? '';
          return (
            <Link key={s.id} to={`/g/${g.group.id}`} className="card p-3.5 flex items-center gap-3" style={{ borderColor: 'rgb(var(--c-amber) / 0.35)' }}>
              <Avatar name={from} size={40} />
              <div className="flex-1 min-w-0"><p className="text-sm font-bold truncate">{from} پرداخت کرده</p><p className="text-xs text-ink-2">{g.group.name}</p></div>
              <span className="num font-black text-amber2">{formatAmount(s.amount)}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
