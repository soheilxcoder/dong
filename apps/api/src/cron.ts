import cron from 'node-cron';
import { computeNetBalances, simplifyDebts, formatToman } from '@dong/core';
import { all, expensesOf, getUser, memberIds, now, one, run, settlementsOf, uid } from './db.js';
import { sendPush } from './push.js';

const DAYS: Record<string, number> = { once: Infinity, every_1_day: 1, every_2_days: 2, every_3_days: 3, weekly: 7 };

/** Section 7.5 — automatic reminders for debts open longer than the configured interval (default 3 days). Runs 10:00 server time. */
export function startCron() {
  cron.schedule('0 10 * * *', async () => {
    for (const g of all<{ id: string; name: string }>('SELECT id, name FROM groups')) {
      const expenses = expensesOf(g.id);
      const balances = computeNetBalances(memberIds(g.id), expenses as never, settlementsOf(g.id) as never);
      for (const t of simplifyDebts(balances)) {
        const rem = one<{ id: string; frequency: string; active: number; lastSentAt: string | null }>('SELECT * FROM reminders WHERE groupId = ? AND targetUserId = ?', g.id, t.from);
        if (rem && !rem.active) continue;
        const every = DAYS[rem?.frequency ?? 'every_3_days'] ?? 3;
        const last = rem?.lastSentAt ? Date.parse(rem.lastSentAt) : 0;
        const oldestOpen = Math.min(...expenses.filter((e) => e.participants.some((p) => p.userId === t.from)).map((e) => Date.parse(e.paidAt as string)), Date.now());
        if (Date.now() - oldestOpen < 3 * 86400000) continue;
        if (Date.now() - last < every * 86400000) continue;
        await sendPush(t.from, 'یادآوری دُنگ 🔔', `${formatToman(t.amount)} به ${getUser(t.to)?.fullName ?? 'دوستت'} در «${g.name}» بدهکاری`);
        if (rem) run('UPDATE reminders SET lastSentAt = ? WHERE id = ?', now(), rem.id);
        else run('INSERT INTO reminders (id, groupId, targetUserId, createdBy, frequency, active, lastSentAt, createdAt) VALUES (?,?,?,?,?,1,?,?)', uid(), g.id, t.from, t.to, 'every_3_days', now(), now());
      }
    }
  });
}
