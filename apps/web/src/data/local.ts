import Dexie, { type Table } from 'dexie';
import type { Activity, ActivityType, Expense, Group, Membership, Reminder, Settlement, User } from '@dong/core';
import { computeNetBalances, formatToman, normalizeCardNumber } from '@dong/core';
import { AppError, type DataAdapter, type ExpenseInput, type GroupDetail, type RegisterInput } from './adapter';

interface LocalUser extends User { passwordHash: string; securityQuestion?: string | null; securityAnswerHash?: string | null; isLocalOnly?: boolean }

class DongDB extends Dexie {
  users!: Table<LocalUser, string>;
  groups!: Table<Group, string>;
  memberships!: Table<Membership, string>;
  expenses!: Table<Expense, string>;
  settlements!: Table<Settlement, string>;
  activity!: Table<Activity, string>;
  reminders!: Table<Reminder, string>;
  kv!: Table<{ key: string; value: string }, string>;
  constructor() {
    super('dong');
    this.version(1).stores({
      users: 'id, &username',
      groups: 'id, &inviteToken',
      memberships: 'id, groupId, userId, [groupId+userId]',
      expenses: 'id, groupId, paidAt',
      settlements: 'id, groupId, fromUser, toUser, status',
      activity: 'id, groupId, createdAt',
      reminders: 'id, groupId, [groupId+targetUserId]',
      kv: 'key',
    });
  }
}

const db = new DongDB();
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
const now = () => new Date().toISOString();
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 12);

async function hash(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('dong::' + s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}
const strip = (u: LocalUser): User => {
  const { passwordHash: _p, securityAnswerHash: _s, securityQuestion: _q, ...rest } = u;
  return rest;
};

export class LocalAdapter implements DataAdapter {
  readonly kind = 'local' as const;
  private listeners = new Set<() => void>();
  private currentId: string | null = localStorage.getItem('dong.session');

  private emit() { this.listeners.forEach((l) => l()); }
  subscribe(cb: () => void) { this.listeners.add(cb); return () => { this.listeners.delete(cb); }; }
  private async requireUser() {
    if (!this.currentId) throw new AppError('UNAUTHENTICATED', 'ابتدا وارد شوید');
    const u = await db.users.get(this.currentId);
    if (!u) throw new AppError('UNAUTHENTICATED', 'ابتدا وارد شوید');
    return u;
  }
  private async log(groupId: string, actorId: string, type: ActivityType, description: string, meta?: Record<string, unknown>) {
    await db.activity.add({ id: uid(), groupId, actorId, type, description, meta, createdAt: now() });
  }
  private async userName(id: string) { return (await db.users.get(id))?.fullName ?? 'کاربر'; }

  // ---------- auth ----------
  async register(input: RegisterInput) {
    const username = input.username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new AppError('BAD_USERNAME', 'نام کاربری فقط حروف انگلیسی، عدد و _ (۳ تا ۲۰ کاراکتر)');
    if (input.password.length < 4) throw new AppError('BAD_PASSWORD', 'رمز عبور حداقل ۴ کاراکتر باشد');
    if (await db.users.where('username').equals(username).first()) throw new AppError('USERNAME_TAKEN', 'این نام کاربری قبلاً گرفته شده');
    const u: LocalUser = {
      id: uid(), fullName: input.fullName.trim(), username, passwordHash: await hash(input.password),
      securityQuestion: input.securityQuestion || null,
      securityAnswerHash: input.securityAnswer ? await hash(input.securityAnswer.trim()) : null,
      cardNumber: input.cardNumber ? normalizeCardNumber(input.cardNumber) : null,
      createdAt: now(),
    };
    await db.users.add(u);
    this.currentId = u.id; localStorage.setItem('dong.session', u.id);
    this.emit();
    return strip(u);
  }
  async login(username: string, password: string) {
    const u = await db.users.where('username').equals(username.trim().toLowerCase()).first();
    if (!u || u.passwordHash !== (await hash(password))) throw new AppError('BAD_CREDENTIALS', 'نام کاربری یا رمز عبور اشتباه است');
    this.currentId = u.id; localStorage.setItem('dong.session', u.id); this.emit();
    return strip(u);
  }
  async logout() { this.currentId = null; localStorage.removeItem('dong.session'); this.emit(); }
  async me() { if (!this.currentId) return null; const u = await db.users.get(this.currentId); return u ? strip(u) : null; }
  async getSecurityQuestion(username: string) {
    const u = await db.users.where('username').equals(username.trim().toLowerCase()).first();
    return u?.securityQuestion ?? null;
  }
  async resetPassword(username: string, answer: string, newPassword: string) {
    const u = await db.users.where('username').equals(username.trim().toLowerCase()).first();
    if (!u || !u.securityAnswerHash || u.securityAnswerHash !== (await hash(answer.trim()))) throw new AppError('BAD_ANSWER', 'پاسخ سؤال امنیتی اشتباه است');
    await db.users.update(u.id, { passwordHash: await hash(newPassword) });
  }
  async updateMe(patch: Partial<Pick<User, 'fullName' | 'avatarUrl' | 'cardNumber' | 'cardHolderName'>>) {
    const u = await this.requireUser();
    const p = { ...patch };
    if (p.cardNumber !== undefined && p.cardNumber !== null) p.cardNumber = normalizeCardNumber(p.cardNumber) || null;
    await db.users.update(u.id, p);
    this.emit();
    return strip((await db.users.get(u.id))!);
  }
  async changePassword(oldPw: string, newPw: string) {
    const u = await this.requireUser();
    if (u.passwordHash !== (await hash(oldPw))) throw new AppError('BAD_CREDENTIALS', 'رمز فعلی اشتباه است');
    await db.users.update(u.id, { passwordHash: await hash(newPw) });
  }

  // ---------- groups ----------
  private async detail(group: Group): Promise<GroupDetail> {
    const ms = await db.memberships.where('groupId').equals(group.id).toArray();
    const users = await db.users.bulkGet(ms.map((m) => m.userId));
    const members = ms.map((m, i) => ({ ...m, user: strip(users[i]!) })).sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
    const expenses = (await db.expenses.where('groupId').equals(group.id).toArray()).sort((a, b) => b.paidAt.localeCompare(a.paidAt) || b.createdAt.localeCompare(a.createdAt));
    const settlements = (await db.settlements.where('groupId').equals(group.id).toArray()).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    return { group, members, expenses, settlements };
  }
  async myGroups() {
    const u = await this.requireUser();
    const ms = await db.memberships.where('userId').equals(u.id).toArray();
    const groups = (await db.groups.bulkGet(ms.map((m) => m.groupId))).filter(Boolean) as Group[];
    return Promise.all(groups.map((g) => this.detail(g)));
  }
  async createGroup(name: string, description?: string, coverImageUrl?: string | null) {
    const u = await this.requireUser();
    const g: Group = { id: uid(), name: name.trim(), description: description?.trim() || null, coverImageUrl: coverImageUrl ?? null, createdBy: u.id, inviteToken: token(), createdAt: now() };
    await db.groups.add(g);
    await db.memberships.add({ id: uid(), groupId: g.id, userId: u.id, role: 'owner', joinedAt: now() });
    await this.log(g.id, u.id, 'group_created', `${u.fullName} گروه «${g.name}» را ساخت`);
    this.emit();
    return g;
  }
  async updateGroup(id: string, patch: Partial<Pick<Group, 'name' | 'description' | 'coverImageUrl'>>) {
    await this.requireUser();
    await db.groups.update(id, patch); this.emit();
    return (await db.groups.get(id))!;
  }
  async getGroup(id: string) {
    const u = await this.requireUser();
    const g = await db.groups.get(id);
    if (!g) throw new AppError('NOT_FOUND', 'گروه پیدا نشد');
    const m = await db.memberships.where('[groupId+userId]').equals([id, u.id]).first();
    if (!m) throw new AppError('FORBIDDEN', 'شما عضو این گروه نیستید');
    return this.detail(g);
  }
  async groupByInvite(t: string) {
    const g = await db.groups.where('inviteToken').equals(t).first();
    if (!g) return null;
    return { group: g, memberCount: await db.memberships.where('groupId').equals(g.id).count() };
  }
  async joinGroup(t: string) {
    const u = await this.requireUser();
    const g = await db.groups.where('inviteToken').equals(t).first();
    if (!g) throw new AppError('NOT_FOUND', 'لینک دعوت نامعتبر است');
    const exists = await db.memberships.where('[groupId+userId]').equals([g.id, u.id]).first();
    if (!exists) {
      await db.memberships.add({ id: uid(), groupId: g.id, userId: u.id, role: 'member', joinedAt: now() });
      await this.log(g.id, u.id, 'member_joined', `${u.fullName} به گروه پیوست`);
      this.emit();
    }
    return g;
  }
  async regenerateInvite(groupId: string) {
    await this.requireUser();
    const t = token(); await db.groups.update(groupId, { inviteToken: t }); this.emit(); return t;
  }
  private async assertSettled(groupId: string, userId: string) {
    const d = await this.detail((await db.groups.get(groupId))!);
    const b = computeNetBalances(d.members.map((m) => m.userId), d.expenses, d.settlements).find((x) => x.userId === userId)?.balance ?? 0;
    if (b !== 0) throw new AppError('UNSETTLED', 'ابتدا حساب‌ها را تسویه کنید');
    const pend = d.settlements.some((s) => s.status === 'pending_confirmation' && (s.fromUser === userId || s.toUser === userId));
    if (pend) throw new AppError('PENDING', 'یک پرداخت در انتظار تأیید وجود دارد');
  }
  async removeMember(groupId: string, userId: string) {
    const u = await this.requireUser();
    const me = await db.memberships.where('[groupId+userId]').equals([groupId, u.id]).first();
    if (me?.role !== 'owner') throw new AppError('FORBIDDEN', 'فقط مالک گروه می‌تواند عضو حذف کند');
    await this.assertSettled(groupId, userId);
    await db.memberships.where('[groupId+userId]').equals([groupId, userId]).delete();
    await this.log(groupId, u.id, 'member_removed', `${u.fullName} ${await this.userName(userId)} را از گروه حذف کرد`);
    this.emit();
  }
  async leaveGroup(groupId: string) {
    const u = await this.requireUser();
    await this.assertSettled(groupId, u.id);
    await db.memberships.where('[groupId+userId]').equals([groupId, u.id]).delete();
    await this.log(groupId, u.id, 'member_left', `${u.fullName} از گروه خارج شد`);
    this.emit();
  }
  async addLocalMember(groupId: string, fullName: string) {
    const u = await this.requireUser();
    const name = fullName.trim();
    if (!name) throw new AppError('BAD_INPUT', 'نام را وارد کنید');
    const local: LocalUser = { id: uid(), fullName: name, username: `local_${uid().slice(0, 8)}`, passwordHash: '', isLocalOnly: true, createdAt: now() };
    await db.users.add(local);
    await db.memberships.add({ id: uid(), groupId, userId: local.id, role: 'member', joinedAt: now() });
    await this.log(groupId, u.id, 'member_joined', `${u.fullName} «${name}» را به گروه اضافه کرد`);
    this.emit();
    return strip(local);
  }

  // ---------- expenses ----------
  private validate(input: ExpenseInput) {
    if (!input.title.trim()) throw new AppError('BAD_INPUT', 'عنوان هزینه را وارد کنید');
    if (!Number.isInteger(input.totalAmount) || input.totalAmount <= 0) throw new AppError('BAD_INPUT', 'مبلغ معتبر نیست');
    if (!input.participants.length) throw new AppError('BAD_INPUT', 'حداقل یک شرکت‌کننده انتخاب کنید');
    const sum = input.participants.reduce((s, p) => s + p.amountOwed, 0);
    if (sum !== input.totalAmount) throw new AppError('SUM_MISMATCH', `مجموع سهم‌ها (${formatToman(sum)}) با مبلغ کل برابر نیست`);
  }
  async addExpense(groupId: string, input: ExpenseInput) {
    const u = await this.requireUser();
    this.validate(input);
    const e: Expense = { id: uid(), groupId, ...input, status: 'open', createdBy: u.id, createdAt: now() };
    await db.expenses.add(e);
    await this.log(groupId, u.id, 'expense_created', `${u.fullName} هزینه «${e.title}» به مبلغ ${formatToman(e.totalAmount)} ثبت کرد`, { expenseId: e.id });
    this.emit();
    return e;
  }
  async updateExpense(id: string, input: ExpenseInput) {
    const u = await this.requireUser();
    const old = await db.expenses.get(id);
    if (!old) throw new AppError('NOT_FOUND', 'هزینه پیدا نشد');
    const m = await db.memberships.where('[groupId+userId]').equals([old.groupId, u.id]).first();
    if (old.createdBy !== u.id && m?.role !== 'owner') throw new AppError('FORBIDDEN', 'فقط ثبت‌کننده یا مالک گروه می‌تواند ویرایش کند');
    this.validate(input);
    const e: Expense = { ...old, ...input, updatedAt: now() };
    await db.expenses.put(e);
    const desc = old.totalAmount !== e.totalAmount
      ? `${u.fullName} مبلغ «${e.title}» را از ${formatToman(old.totalAmount)} به ${formatToman(e.totalAmount)} ویرایش کرد`
      : `${u.fullName} هزینه «${e.title}» را ویرایش کرد`;
    await this.log(old.groupId, u.id, 'expense_updated', desc, { expenseId: id });
    this.emit();
    return e;
  }
  async deleteExpense(id: string) {
    const u = await this.requireUser();
    const e = await db.expenses.get(id);
    if (!e) return;
    const m = await db.memberships.where('[groupId+userId]').equals([e.groupId, u.id]).first();
    if (e.createdBy !== u.id && m?.role !== 'owner') throw new AppError('FORBIDDEN', 'فقط ثبت‌کننده یا مالک گروه می‌تواند حذف کند');
    const pending = await db.settlements.where('groupId').equals(e.groupId).filter((s) => s.status === 'pending_confirmation').count();
    if (pending > 0) throw new AppError('HAS_SETTLEMENTS', 'برای این گروه پرداخت در انتظار تأیید وجود دارد؛ ابتدا آن‌ها را تعیین تکلیف کنید');
    await db.expenses.delete(id);
    await this.log(e.groupId, u.id, 'expense_deleted', `${u.fullName} هزینه «${e.title}» (${formatToman(e.totalAmount)}) را حذف کرد`);
    this.emit();
  }

  // ---------- settlements ----------
  async submitSettlement(groupId: string, toUser: string, amount: number, receiptImageUrl?: string | null, note?: string | null, fromUser?: string) {
    const u = await this.requireUser();
    if (!Number.isInteger(amount) || amount <= 0) throw new AppError('BAD_INPUT', 'مبلغ معتبر نیست');
    const from = fromUser ?? u.id;
    const s: Settlement = { id: uid(), groupId, fromUser: from, toUser, amount, receiptImageUrl: receiptImageUrl ?? null, note: note ?? null, status: 'pending_confirmation', submittedAt: now() };
    // local-only members / self-recorded: if creditor is me, or debtor is a local member, auto-confirm
    const toU = await db.users.get(toUser); const fromU = await db.users.get(from);
    if (toUser === u.id || toU?.isLocalOnly || fromU?.isLocalOnly) { s.status = 'confirmed'; s.confirmedAt = now(); }
    await db.settlements.add(s);
    await this.log(groupId, u.id, s.status === 'confirmed' ? 'settlement_confirmed' : 'settlement_submitted',
      s.status === 'confirmed'
        ? `پرداخت ${formatToman(amount)} از ${await this.userName(from)} به ${await this.userName(toUser)} ثبت و تأیید شد`
        : `${u.fullName} پرداخت ${formatToman(amount)} به ${await this.userName(toUser)} را ثبت کرد (در انتظار تأیید)`, { settlementId: s.id });
    this.emit();
    return s;
  }
  async confirmSettlement(id: string) {
    const u = await this.requireUser();
    const s = await db.settlements.get(id);
    if (!s || s.status !== 'pending_confirmation') throw new AppError('BAD_STATE', 'این پرداخت قابل تأیید نیست');
    if (s.toUser !== u.id) throw new AppError('FORBIDDEN', 'فقط دریافت‌کننده می‌تواند تأیید کند');
    await db.settlements.update(id, { status: 'confirmed', confirmedAt: now() });
    await this.log(s.groupId, u.id, 'settlement_confirmed', `${u.fullName} دریافت ${formatToman(s.amount)} از ${await this.userName(s.fromUser)} را تأیید کرد`, { settlementId: id });
    this.emit();
  }
  async rejectSettlement(id: string, reason: string) {
    const u = await this.requireUser();
    const s = await db.settlements.get(id);
    if (!s || s.status !== 'pending_confirmation') throw new AppError('BAD_STATE', 'این پرداخت قابل رد نیست');
    if (s.toUser !== u.id) throw new AppError('FORBIDDEN', 'فقط دریافت‌کننده می‌تواند رد کند');
    if (!reason.trim()) throw new AppError('BAD_INPUT', 'دلیل رد را بنویسید');
    await db.settlements.update(id, { status: 'rejected', rejectReason: reason.trim() });
    await this.log(s.groupId, u.id, 'settlement_rejected', `${u.fullName} پرداخت ${formatToman(s.amount)} از ${await this.userName(s.fromUser)} را رد کرد: «${reason.trim()}»`, { settlementId: id });
    this.emit();
  }
  async cancelSettlement(id: string) {
    const u = await this.requireUser();
    const s = await db.settlements.get(id);
    if (!s || s.status !== 'pending_confirmation' || s.fromUser !== u.id) throw new AppError('BAD_STATE', 'قابل لغو نیست');
    await db.settlements.delete(id); this.emit();
  }

  // ---------- activity / reminders ----------
  async activity(groupId: string) {
    await this.requireUser();
    return (await db.activity.where('groupId').equals(groupId).toArray()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async sendReminder(groupId: string, targetUserId: string, amount: number) {
    const u = await this.requireUser();
    const r = await db.reminders.where('[groupId+targetUserId]').equals([groupId, targetUserId]).first();
    if (r?.lastSentAt && Date.now() - new Date(r.lastSentAt).getTime() < 24 * 3600 * 1000) throw new AppError('RATE_LIMIT', 'روزی فقط یک یادآوری می‌توانید بفرستید');
    if (r) await db.reminders.update(r.id, { lastSentAt: now() });
    else await db.reminders.add({ id: uid(), groupId, targetUserId, createdBy: u.id, frequency: 'once', active: true, lastSentAt: now() });
    await this.log(groupId, u.id, 'reminder_sent', `${u.fullName} برای ${await this.userName(targetUserId)} یادآوری بدهی ${formatToman(amount)} فرستاد`);
    this.emit();
  }
  async reminders(groupId: string) { return db.reminders.where('groupId').equals(groupId).toArray(); }

  // ---------- demo ----------
  async loadDemo() {
    const me = await this.requireUser();
    const mk = async (name: string, card?: string): Promise<LocalUser> => {
      const u: LocalUser = { id: uid(), fullName: name, username: `demo_${uid().slice(0, 6)}`, passwordHash: '', isLocalOnly: true, cardNumber: card ?? null, createdAt: now() };
      await db.users.add(u); return u;
    };
    const reza = await mk('رضا', '6104337812345678');
    const hossein = await mk('حسین', '6037997712345678');
    const mohammad = await mk('محمد');
    const g: Group = { id: uid(), name: 'سفر کیش', description: 'نمونه — چهار نفر، چهار خرج، یک تسویه ساده', coverImageUrl: null, createdBy: me.id, inviteToken: token(), createdAt: now() };
    await db.groups.add(g);
    const t0 = Date.now() - 4 * 86400000;
    const d = (i: number) => new Date(t0 + i * 86400000).toISOString();
    await db.memberships.bulkAdd([
      { id: uid(), groupId: g.id, userId: me.id, role: 'owner', joinedAt: d(0) },
      { id: uid(), groupId: g.id, userId: reza.id, role: 'member', joinedAt: d(0) },
      { id: uid(), groupId: g.id, userId: hossein.id, role: 'member', joinedAt: d(0) },
      { id: uid(), groupId: g.id, userId: mohammad.id, role: 'member', joinedAt: d(0) },
    ]);
    const ex = (i: number, title: string, total: number, paidBy: string, shares: [string, number][]): Expense => ({
      id: uid(), groupId: g.id, title, totalAmount: total, paidBy, paidAt: d(i), splitType: 'equal',
      participants: shares.map(([userId, amountOwed]) => ({ userId, amountOwed })), status: 'open', createdBy: paidBy, createdAt: d(i),
    });
    const A = me.id, R = reza.id, H = hossein.id, M = mohammad.id;
    const list = [
      ex(0, 'ناهار روز اول', 400_000, A, [[A, 100_000], [R, 100_000], [H, 100_000], [M, 100_000]]),
      ex(1, 'تاکسی فرودگاه', 200_000, R, [[R, 100_000], [H, 100_000]]),
      ex(2, 'شام روز دوم', 600_000, H, [[A, 200_000], [H, 200_000], [M, 200_000]]),
      ex(3, 'بلیط تفریحی', 300_000, M, [[A, 75_000], [R, 75_000], [H, 75_000], [M, 75_000]]),
    ];
    await db.expenses.bulkAdd(list);
    await this.log(g.id, me.id, 'group_created', `${me.fullName} گروه «سفر کیش» را ساخت`);
    for (const e of list) await this.log(g.id, e.paidBy, 'expense_created', `${await this.userName(e.paidBy)} هزینه «${e.title}» به مبلغ ${formatToman(e.totalAmount)} ثبت کرد`);
    this.emit();
  }
}
