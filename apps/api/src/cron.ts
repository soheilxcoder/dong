import cron from 'node-cron';
import { computeNetBalances, simplifyDebts, formatToman } from '@dong/core';
import { prisma, toCoreExpense, toCoreSettlement } from './lib.js';
import { sendPush } from './push.js';

const DAYS: Record<string, number> = { once: Infinity, every_1_day: 1, every_2_days: 2, every_3_days: 3, weekly: 7 };

/** Section 7.5 — automatic reminders for debts open longer than the configured interval (default 3 days). */
export function startCron() {
  cron.schedule('0 10 * * *', async () => {
    const groups = await prisma.group.findMany({ include: { members: true, expenses: { include: { participants: true } }, settlements: true, reminders: true } });
    for (const g of groups) {
      const balances = computeNetBalances(g.members.map((m) => m.userId), g.expenses.map(toCoreExpense) as never, g.settlements.map(toCoreSettlement) as never);
      for (const t of simplifyDebts(balances)) {
        const rem = g.reminders.find((r) => r.targetUserId === t.from);
        const every = DAYS[rem?.frequency ?? 'every_3_days'] ?? 3;
        if (rem && !rem.active) continue;
        const last = rem?.lastSentAt?.getTime() ?? 0;
        const oldestOpen = Math.min(...g.expenses.filter((e) => e.participants.some((p) => p.userId === t.from)).map((e) => e.paidAt.getTime()), Date.now());
        if (Date.now() - oldestOpen < 3 * 86400000) continue;
        if (Date.now() - last < every * 86400000) continue;
        const to = await prisma.user.findUnique({ where: { id: t.to } });
        await sendPush(t.from, 'یادآوری دُنگ 🔔', `${formatToman(t.amount)} به ${to?.fullName ?? 'دوستت'} در «${g.name}» بدهکاری`);
        await prisma.reminder.upsert({ where: { groupId_targetUserId: { groupId: g.id, targetUserId: t.from } }, create: { groupId: g.id, targetUserId: t.from, createdBy: t.to, lastSentAt: new Date() }, update: { lastSentAt: new Date() } });
      }
    }
  });
}
