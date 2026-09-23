import type { Balance, Expense, ID, Settlement, Transfer } from './types';

/** Section 4.1 — raw net balance. All amounts are integers (toman). */
export function computeNetBalances(
  memberIds: ID[],
  expenses: Expense[],
  settlements: Settlement[],
): Balance[] {
  const net = new Map<ID, number>();
  for (const id of memberIds) net.set(id, 0);
  const add = (id: ID, v: number) => net.set(id, (net.get(id) ?? 0) + v);

  for (const e of expenses) {
    if (e.status === 'archived') continue;
    add(e.paidBy, e.totalAmount);
    for (const p of e.participants) add(p.userId, -p.amountOwed);
  }
  for (const s of settlements) {
    if (s.status !== 'confirmed') continue;
    add(s.fromUser, s.amount);
    add(s.toUser, -s.amount);
  }
  return [...net.entries()].map(([userId, balance]) => ({ userId, balance }));
}

/**
 * Section 4.2 — greedy debt simplification.
 * Always matches the largest debtor with the largest creditor, producing at most (n-1) transfers.
 * Deterministic: ties are broken by userId so results are stable across runs/devices.
 */
export function simplifyDebts(balances: Balance[]): Transfer[] {
  const debtors = balances.filter((b) => b.balance < 0).map((b) => ({ ...b }));
  const creditors = balances.filter((b) => b.balance > 0).map((b) => ({ ...b }));
  const byMagnitudeDesc = (a: Balance, b: Balance) =>
    Math.abs(b.balance) - Math.abs(a.balance) || a.userId.localeCompare(b.userId);

  const result: Transfer[] = [];
  while (debtors.length && creditors.length) {
    debtors.sort(byMagnitudeDesc);
    creditors.sort(byMagnitudeDesc);
    const d = debtors[0];
    const c = creditors[0];
    const amount = Math.min(-d.balance, c.balance);
    if (amount > 0) result.push({ from: d.userId, to: c.userId, amount });
    d.balance += amount;
    c.balance -= amount;
    if (d.balance === 0) debtors.shift();
    if (c.balance === 0) creditors.shift();
  }
  return result;
}

export function settlementPlan(memberIds: ID[], expenses: Expense[], settlements: Settlement[]) {
  const balances = computeNetBalances(memberIds, expenses, settlements);
  return { balances, transfers: simplifyDebts(balances) };
}

/** Section 4.3 — equal split; remainder goes to the first participants (1 toman each). */
export function splitEqual(total: number, participantIds: ID[]): { userId: ID; amountOwed: number }[] {
  if (!Number.isInteger(total) || total < 0) throw new Error('INVALID_AMOUNT');
  const n = participantIds.length;
  if (n === 0) throw new Error('NO_PARTICIPANTS');
  const base = Math.floor(total / n);
  let rem = total - base * n;
  return participantIds.map((userId) => {
    const extra = rem > 0 ? 1 : 0;
    rem -= extra;
    return { userId, amountOwed: base + extra };
  });
}

export function validateCustomSplit(total: number, shares: { userId: ID; amountOwed: number }[]) {
  const sum = shares.reduce((s, x) => s + x.amountOwed, 0);
  if (shares.some((s) => !Number.isInteger(s.amountOwed) || s.amountOwed < 0)) return { ok: false as const, diff: 0, reason: 'NEGATIVE_OR_FLOAT' };
  if (sum !== total) return { ok: false as const, diff: total - sum, reason: 'SUM_MISMATCH' };
  return { ok: true as const, diff: 0 };
}

/** Net position of a single user in a group (+ creditor / - debtor). */
export function userBalance(userId: ID, balances: Balance[]) {
  return balances.find((b) => b.userId === userId)?.balance ?? 0;
}

/** Pending (not yet confirmed) settlements from a user to another. */
export function pendingBetween(settlements: Settlement[], from: ID, to: ID) {
  return settlements
    .filter((s) => s.status === 'pending_confirmation' && s.fromUser === from && s.toUser === to)
    .reduce((s, x) => s + x.amount, 0);
}
