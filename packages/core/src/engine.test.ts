import { describe, it, expect } from 'vitest';
import { computeNetBalances, simplifyDebts, splitEqual, validateCustomSplit } from './engine';
import type { Expense, Settlement } from './types';

const now = new Date().toISOString();
const G = 'g1';
const mk = (id: string, total: number, paidBy: string, shares: Record<string, number>): Expense => ({
  id, groupId: G, title: id, totalAmount: total, paidBy, paidAt: now, splitType: 'custom',
  participants: Object.entries(shares).map(([userId, amountOwed]) => ({ userId, amountOwed })),
  status: 'open', createdBy: paidBy, createdAt: now,
});
const st = (from: string, to: string, amount: number, status: Settlement['status']): Settlement => ({
  id: Math.random().toString(36), groupId: G, fromUser: from, toUser: to, amount, status, submittedAt: now,
});

const members = ['ali', 'reza', 'hossein', 'mohammad'];
const kish: Expense[] = [
  mk('lunch', 400_000, 'ali', { ali: 100_000, reza: 100_000, hossein: 100_000, mohammad: 100_000 }),
  mk('taxi', 200_000, 'reza', { reza: 100_000, hossein: 100_000 }),
  mk('dinner', 600_000, 'hossein', { ali: 200_000, hossein: 200_000, mohammad: 200_000 }),
  mk('ticket', 300_000, 'mohammad', { ali: 75_000, reza: 75_000, hossein: 75_000, mohammad: 75_000 }),
];

const bal = (b: ReturnType<typeof computeNetBalances>, id: string) => b.find((x) => x.userId === id)!.balance;

describe('Kish trip — spec section 2', () => {
  it('computes net balances exactly', () => {
    const b = computeNetBalances(members, kish, []);
    expect(bal(b, 'ali')).toBe(25_000);
    expect(bal(b, 'reza')).toBe(-75_000);
    expect(bal(b, 'hossein')).toBe(125_000);
    expect(bal(b, 'mohammad')).toBe(-75_000);
    expect(b.reduce((s, x) => s + x.balance, 0)).toBe(0);
  });
  it('simplifies to minimum transfers (3) and preserves totals', () => {
    const b = computeNetBalances(members, kish, []);
    const t = simplifyDebts(b);
    expect(t.length).toBe(3);
    const received = (id: string) => t.filter((x) => x.to === id).reduce((s, x) => s + x.amount, 0);
    const paid = (id: string) => t.filter((x) => x.from === id).reduce((s, x) => s + x.amount, 0);
    expect(received('hossein')).toBe(125_000);
    expect(received('ali')).toBe(25_000);
    expect(paid('reza')).toBe(75_000);
    expect(paid('mohammad')).toBe(75_000);
  });
});

describe('Edge cases', () => {
  it('payer who never participates becomes pure creditor', () => {
    const e = [mk('x', 90_000, 'ali', { reza: 45_000, hossein: 45_000 })];
    const b = computeNetBalances(members, e, []);
    expect(bal(b, 'ali')).toBe(90_000);
    expect(bal(b, 'mohammad')).toBe(0);
    expect(simplifyDebts(b)).toHaveLength(2);
  });
  it('equal split with remainder sums exactly to total', () => {
    const s = splitEqual(100_001, ['a', 'b', 'c']);
    expect(s.reduce((x, y) => x + y.amountOwed, 0)).toBe(100_001);
    expect(s.map((x) => x.amountOwed)).toEqual([33_334, 33_334, 33_333]);
  });
  it('partial settlements sum to zero the debt', () => {
    const e = [mk('x', 100_000, 'ali', { ali: 50_000, reza: 50_000 })];
    const s = [st('reza', 'ali', 20_000, 'confirmed'), st('reza', 'ali', 30_000, 'confirmed')];
    const b = computeNetBalances(['ali', 'reza'], e, s);
    expect(bal(b, 'reza')).toBe(0);
    expect(simplifyDebts(b)).toHaveLength(0);
  });
  it('rejected / pending settlements do not affect balances', () => {
    const e = [mk('x', 100_000, 'ali', { ali: 50_000, reza: 50_000 })];
    const s = [st('reza', 'ali', 50_000, 'rejected'), st('reza', 'ali', 50_000, 'pending_confirmation')];
    expect(bal(computeNetBalances(['ali', 'reza'], e, s), 'reza')).toBe(-50_000);
  });
  it('custom split validation', () => {
    expect(validateCustomSplit(100, [{ userId: 'a', amountOwed: 60 }, { userId: 'b', amountOwed: 40 }]).ok).toBe(true);
    expect(validateCustomSplit(100, [{ userId: 'a', amountOwed: 60 }, { userId: 'b', amountOwed: 30 }]).diff).toBe(10);
  });
  it('random inputs: conservation and at most n-1 transfers', () => {
    for (let iter = 0; iter < 300; iter++) {
      const n = 2 + Math.floor(Math.random() * 8);
      const ids = Array.from({ length: n }, (_, i) => `u${i}`);
      const raw = ids.map(() => Math.floor(Math.random() * 2_000_000) - 1_000_000);
      const sum = raw.reduce((a, b) => a + b, 0);
      raw[0] -= sum;
      const balances = ids.map((userId, i) => ({ userId, balance: raw[i] }));
      const t = simplifyDebts(balances);
      expect(t.length).toBeLessThanOrEqual(n - 1);
      for (const b of balances) {
        const inn = t.filter((x) => x.to === b.userId).reduce((s, x) => s + x.amount, 0);
        const out = t.filter((x) => x.from === b.userId).reduce((s, x) => s + x.amount, 0);
        expect(inn - out).toBe(b.balance);
      }
      expect(t.every((x) => x.amount > 0 && Number.isInteger(x.amount))).toBe(true);
    }
  });
});
