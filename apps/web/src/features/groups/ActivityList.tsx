import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Receipt, Pencil, Trash2, Send, CheckCircle2, XCircle, UserPlus, UserMinus, Sparkles, BellRing } from 'lucide-react';
import type { Activity } from '@dong/core';
import { fmtDateTime } from '@/lib/date';

const icons: Record<Activity['type'], { I: typeof Receipt; c: string }> = {
  expense_created: { I: Receipt, c: 'text-brand bg-brand/15' },
  expense_updated: { I: Pencil, c: 'text-amber2 bg-amber2/15' },
  expense_deleted: { I: Trash2, c: 'text-neg bg-neg/15' },
  settlement_submitted: { I: Send, c: 'text-amber2 bg-amber2/15' },
  settlement_confirmed: { I: CheckCircle2, c: 'text-pos bg-pos/15' },
  settlement_rejected: { I: XCircle, c: 'text-neg bg-neg/15' },
  member_joined: { I: UserPlus, c: 'text-brand-2 bg-brand-2/15' },
  member_left: { I: UserMinus, c: 'text-neutral2 bg-neutral2/15' },
  member_removed: { I: UserMinus, c: 'text-neg bg-neg/15' },
  group_created: { I: Sparkles, c: 'text-brand bg-brand/15' },
  reminder_sent: { I: BellRing, c: 'text-amber2 bg-amber2/15' },
};

export function ActivityList({ items, renderGroup }: { items: Activity[]; renderGroup?: (a: Activity) => ReactNode }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((a, i) => {
        const { I, c } = icons[a.type] ?? icons.group_created;
        return (
          <motion.li key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }} className="card p-3.5 flex gap-3">
            <span className={`h-10 w-10 shrink-0 rounded-2xl grid place-items-center ${c}`}><I size={18} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-6">{a.description}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-ink-2"><span>{fmtDateTime(a.createdAt)}</span>{renderGroup && <>·{renderGroup(a)}</>}</div>
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}
