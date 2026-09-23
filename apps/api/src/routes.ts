import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import QRCode from 'qrcode';
import { computeNetBalances, simplifyDebts, normalizeCardNumber, formatToman } from '@dong/core';
import { auth, bad, forbidden, json, log, notFound, parse, prisma, requireMember, signToken, toCoreExpense, toCoreSettlement, token, wrap } from './lib.js';
import { sendPush } from './push.js';

export const r = Router();
const safeUser = { id: true, fullName: true, username: true, avatarUrl: true, cardNumber: true, cardHolderName: true, createdAt: true } as const;

/* ---------------- auth ---------------- */
r.post('/auth/register', wrap(async (req, res) => {
  const b = parse(z.object({ fullName: z.string().min(2), username: z.string().regex(/^[a-z0-9_]{3,20}$/), password: z.string().min(4), securityQuestion: z.string().optional(), securityAnswer: z.string().optional(), cardNumber: z.string().optional() }), req.body);
  if (await prisma.user.findUnique({ where: { username: b.username } })) throw bad('این نام کاربری قبلاً گرفته شده', 'USERNAME_TAKEN');
  if (b.cardNumber && !/^\d{16}$/.test(normalizeCardNumber(b.cardNumber))) throw bad('شماره کارت باید ۱۶ رقم باشد');
  const u = await prisma.user.create({
    data: { fullName: b.fullName, username: b.username, passwordHash: await bcrypt.hash(b.password, 10), securityQuestion: b.securityQuestion || null, securityAnswerHash: b.securityAnswer ? await bcrypt.hash(b.securityAnswer.trim(), 10) : null, cardNumber: b.cardNumber ? normalizeCardNumber(b.cardNumber) : null },
    select: safeUser,
  });
  res.json({ user: u, token: signToken(u.id) });
}));
r.post('/auth/login', wrap(async (req, res) => {
  const b = parse(z.object({ username: z.string(), password: z.string() }), req.body);
  const u = await prisma.user.findUnique({ where: { username: b.username.toLowerCase() } });
  if (!u || !(await bcrypt.compare(b.password, u.passwordHash))) throw bad('نام کاربری یا رمز عبور اشتباه است', 'BAD_CREDENTIALS');
  const { passwordHash: _p, securityAnswerHash: _s, securityQuestion: _q, ...user } = u;
  res.json({ user, token: signToken(u.id) });
}));
r.get('/auth/security-question/:username', wrap(async (req, res) => {
  const u = await prisma.user.findUnique({ where: { username: req.params.username.toLowerCase() } });
  res.json({ question: u?.securityQuestion ?? null });
}));
r.post('/auth/reset-password-with-security-answer', wrap(async (req, res) => {
  const b = parse(z.object({ username: z.string(), answer: z.string(), newPassword: z.string().min(4) }), req.body);
  const u = await prisma.user.findUnique({ where: { username: b.username.toLowerCase() } });
  if (!u?.securityAnswerHash || !(await bcrypt.compare(b.answer.trim(), u.securityAnswerHash))) throw bad('پاسخ سؤال امنیتی اشتباه است', 'BAD_ANSWER');
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(b.newPassword, 10) } });
  res.json({ ok: true });
}));

/* ---------------- users ---------------- */
r.get('/users/me', auth, wrap(async (req, res) => { res.json(await prisma.user.findUnique({ where: { id: req.userId }, select: safeUser })); }));
r.patch('/users/me', auth, wrap(async (req, res) => {
  const b = parse(z.object({ fullName: z.string().min(2).optional(), avatarUrl: z.string().nullable().optional(), cardNumber: z.string().nullable().optional(), cardHolderName: z.string().nullable().optional() }), req.body);
  if (b.cardNumber) { b.cardNumber = normalizeCardNumber(b.cardNumber); if (!/^\d{16}$/.test(b.cardNumber)) throw bad('شماره کارت باید ۱۶ رقم باشد'); }
  res.json(await prisma.user.update({ where: { id: req.userId }, data: b, select: safeUser }));
}));
r.post('/users/me/password', auth, wrap(async (req, res) => {
  const b = parse(z.object({ oldPassword: z.string(), newPassword: z.string().min(4) }), req.body);
  const u = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  if (!(await bcrypt.compare(b.oldPassword, u.passwordHash))) throw bad('رمز فعلی اشتباه است', 'BAD_CREDENTIALS');
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(b.newPassword, 10) } });
  res.json({ ok: true });
}));
r.post('/users/me/push', auth, wrap(async (req, res) => {
  const b = parse(z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string(), auth: z.string() }) }), req.body);
  await prisma.pushSubscription.upsert({ where: { endpoint: b.endpoint }, create: { userId: req.userId, endpoint: b.endpoint, keys: b.keys }, update: { userId: req.userId, keys: b.keys } });
  res.json({ ok: true });
}));

/* ---------------- groups ---------------- */
const detail = async (groupId: string) => {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw notFound('گروه پیدا نشد');
  const members = await prisma.groupMember.findMany({ where: { groupId }, include: { user: { select: safeUser } }, orderBy: { joinedAt: 'asc' } });
  const expenses = await prisma.expense.findMany({ where: { groupId }, include: { participants: true }, orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }] });
  const settlements = await prisma.settlement.findMany({ where: { groupId }, orderBy: { submittedAt: 'desc' } });
  return json({ group, members, expenses, settlements });
};
const balancesOf = async (groupId: string) => {
  const ms = await prisma.groupMember.findMany({ where: { groupId } });
  const ex = await prisma.expense.findMany({ where: { groupId }, include: { participants: true } });
  const st = await prisma.settlement.findMany({ where: { groupId } });
  const balances = computeNetBalances(ms.map((m) => m.userId), ex.map(toCoreExpense) as never, st.map(toCoreSettlement) as never);
  return { balances, transfers: simplifyDebts(balances), pending: st.filter((s) => s.status === 'pending_confirmation') };
};

r.get('/groups', auth, wrap(async (req, res) => {
  const ms = await prisma.groupMember.findMany({ where: { userId: req.userId } });
  res.json(await Promise.all(ms.map((m) => detail(m.groupId))));
}));
r.post('/groups', auth, wrap(async (req, res) => {
  const b = parse(z.object({ name: z.string().min(2), description: z.string().optional(), coverImageUrl: z.string().nullable().optional() }), req.body);
  const g = await prisma.group.create({ data: { ...b, createdBy: req.userId, inviteToken: token(), members: { create: { userId: req.userId, role: 'owner' } } } });
  const u = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  await log(g.id, req.userId, 'group_created', `${u.fullName} گروه «${g.name}» را ساخت`);
  res.status(201).json(g);
}));
r.get('/groups/invite/:token', wrap(async (req, res) => {
  const g = await prisma.group.findUnique({ where: { inviteToken: req.params.token }, select: { id: true, name: true, description: true, coverImageUrl: true, _count: { select: { members: true } } } });
  if (!g) throw notFound('لینک دعوت نامعتبر است');
  res.json({ group: g, memberCount: g._count.members });
}));
r.post('/groups/join/:token', auth, wrap(async (req, res) => {
  const g = await prisma.group.findUnique({ where: { inviteToken: req.params.token } });
  if (!g) throw notFound('لینک دعوت نامعتبر است');
  const exists = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: g.id, userId: req.userId } } });
  if (!exists) {
    await prisma.groupMember.create({ data: { groupId: g.id, userId: req.userId, role: 'member' } });
    const u = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
    await log(g.id, req.userId, 'member_joined', `${u.fullName} به گروه پیوست`);
  }
  res.json(g);
}));
r.get('/groups/:id', auth, wrap(async (req, res) => { await requireMember(req.params.id, req.userId); res.json(await detail(req.params.id)); }));
r.patch('/groups/:id', auth, wrap(async (req, res) => {
  const m = await requireMember(req.params.id, req.userId); if (m.role !== 'owner') throw forbidden();
  const b = parse(z.object({ name: z.string().min(2).optional(), description: z.string().nullable().optional(), coverImageUrl: z.string().nullable().optional() }), req.body);
  res.json(await prisma.group.update({ where: { id: req.params.id }, data: b }));
}));
r.post('/groups/:id/invite/regenerate', auth, wrap(async (req, res) => {
  const m = await requireMember(req.params.id, req.userId); if (m.role !== 'owner') throw forbidden();
  const g = await prisma.group.update({ where: { id: req.params.id }, data: { inviteToken: token() } });
  res.json({ inviteToken: g.inviteToken });
}));
r.get('/groups/:id/invite-qr', auth, wrap(async (req, res) => {
  await requireMember(req.params.id, req.userId);
  const g = await prisma.group.findUniqueOrThrow({ where: { id: req.params.id } });
  const url = `${(process.env.PUBLIC_APP_URL ?? 'http://localhost:5173/').replace(/\/?$/, '/')}#/join/${g.inviteToken}`;
  res.json({ url, qr: await QRCode.toDataURL(url, { margin: 1, width: 512 }) });
}));
r.get('/groups/:id/balances', auth, wrap(async (req, res) => { await requireMember(req.params.id, req.userId); res.json(json(await balancesOf(req.params.id))); }));
r.get('/groups/:id/activity', auth, wrap(async (req, res) => {
  await requireMember(req.params.id, req.userId);
  res.json(await prisma.activityLog.findMany({ where: { groupId: req.params.id }, orderBy: { createdAt: 'desc' }, take: 200 }));
}));
const assertSettled = async (groupId: string, userId: string) => {
  const { balances, pending } = await balancesOf(groupId);
  if ((balances.find((b) => b.userId === userId)?.balance ?? 0) !== 0) throw bad('ابتدا حساب‌ها را تسویه کنید', 'UNSETTLED');
  if (pending.some((s) => s.fromUser === userId || s.toUser === userId)) throw bad('یک پرداخت در انتظار تأیید وجود دارد', 'PENDING');
};
r.delete('/groups/:id/members/:userId', auth, wrap(async (req, res) => {
  const me = await requireMember(req.params.id, req.userId);
  const self = req.params.userId === req.userId;
  if (!self && me.role !== 'owner') throw forbidden('فقط مالک گروه می‌تواند عضو حذف کند');
  await assertSettled(req.params.id, req.params.userId);
  await prisma.groupMember.delete({ where: { groupId_userId: { groupId: req.params.id, userId: req.params.userId } } });
  const [actor, target] = await Promise.all([prisma.user.findUniqueOrThrow({ where: { id: req.userId } }), prisma.user.findUniqueOrThrow({ where: { id: req.params.userId } })]);
  await log(req.params.id, req.userId, self ? 'member_left' : 'member_removed', self ? `${actor.fullName} از گروه خارج شد` : `${actor.fullName} ${target.fullName} را از گروه حذف کرد`);
  res.json({ ok: true });
}));

/* ---------------- expenses ---------------- */
const expenseSchema = z.object({
  title: z.string().min(1), totalAmount: z.number().int().positive(), paidBy: z.string(), paidAt: z.string().datetime(),
  splitType: z.enum(['equal', 'custom', 'by_payer']), participants: z.array(z.object({ userId: z.string(), amountOwed: z.number().int().nonnegative() })).min(1),
  receiptImageUrl: z.string().nullable().optional(), notes: z.string().nullable().optional(),
});
const validateExpense = async (groupId: string, b: z.infer<typeof expenseSchema>) => {
  const sum = b.participants.reduce((s, p) => s + p.amountOwed, 0);
  if (sum !== b.totalAmount) throw bad(`مجموع سهم‌ها (${formatToman(sum)}) با مبلغ کل برابر نیست`, 'SUM_MISMATCH');
  const ids = new Set((await prisma.groupMember.findMany({ where: { groupId } })).map((m) => m.userId));
  if (!ids.has(b.paidBy) || b.participants.some((p) => !ids.has(p.userId))) throw bad('همه شرکت‌کننده‌ها باید عضو گروه باشند');
};
r.get('/groups/:id/expenses', auth, wrap(async (req, res) => { await requireMember(req.params.id, req.userId); res.json(json(await prisma.expense.findMany({ where: { groupId: req.params.id }, include: { participants: true }, orderBy: { paidAt: 'desc' } }))); }));
r.post('/groups/:id/expenses', auth, wrap(async (req, res) => {
  await requireMember(req.params.id, req.userId);
  const b = parse(expenseSchema, req.body); await validateExpense(req.params.id, b);
  const e = await prisma.expense.create({ data: { groupId: req.params.id, title: b.title, totalAmount: BigInt(b.totalAmount), paidBy: b.paidBy, paidAt: new Date(b.paidAt), splitType: b.splitType, receiptImageUrl: b.receiptImageUrl, notes: b.notes, createdBy: req.userId, participants: { create: b.participants.map((p) => ({ userId: p.userId, amountOwed: BigInt(p.amountOwed) })) } }, include: { participants: true } });
  const u = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  await log(req.params.id, req.userId, 'expense_created', `${u.fullName} هزینه «${e.title}» به مبلغ ${formatToman(b.totalAmount)} ثبت کرد`, { expenseId: e.id });
  for (const p of b.participants) if (p.userId !== req.userId) sendPush(p.userId, 'هزینه جدید در دُنگ', `${u.fullName}: «${e.title}» — سهم شما ${formatToman(p.amountOwed)}`).catch(() => {});
  res.status(201).json(json(e));
}));
r.patch('/expenses/:id', auth, wrap(async (req, res) => {
  const old = await prisma.expense.findUnique({ where: { id: req.params.id } }); if (!old) throw notFound();
  const m = await requireMember(old.groupId, req.userId);
  if (old.createdBy !== req.userId && m.role !== 'owner') throw forbidden('فقط ثبت‌کننده یا مالک گروه می‌تواند ویرایش کند');
  const b = parse(expenseSchema, req.body); await validateExpense(old.groupId, b);
  const e = await prisma.$transaction(async (tx) => {
    await tx.expenseParticipant.deleteMany({ where: { expenseId: old.id } });
    return tx.expense.update({ where: { id: old.id }, data: { title: b.title, totalAmount: BigInt(b.totalAmount), paidBy: b.paidBy, paidAt: new Date(b.paidAt), splitType: b.splitType, receiptImageUrl: b.receiptImageUrl, notes: b.notes, participants: { create: b.participants.map((p) => ({ userId: p.userId, amountOwed: BigInt(p.amountOwed) })) } }, include: { participants: true } });
  });
  const u = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  await log(old.groupId, req.userId, 'expense_updated', Number(old.totalAmount) !== b.totalAmount ? `${u.fullName} مبلغ «${e.title}» را از ${formatToman(Number(old.totalAmount))} به ${formatToman(b.totalAmount)} ویرایش کرد` : `${u.fullName} هزینه «${e.title}» را ویرایش کرد`, { expenseId: e.id });
  res.json(json(e));
}));
r.delete('/expenses/:id', auth, wrap(async (req, res) => {
  const e = await prisma.expense.findUnique({ where: { id: req.params.id } }); if (!e) throw notFound();
  const m = await requireMember(e.groupId, req.userId);
  if (e.createdBy !== req.userId && m.role !== 'owner') throw forbidden('فقط ثبت‌کننده یا مالک گروه می‌تواند حذف کند');
  const pending = await prisma.settlement.count({ where: { groupId: e.groupId, status: 'pending_confirmation' } });
  if (pending) throw bad('پرداخت در انتظار تأیید وجود دارد؛ ابتدا آن‌ها را تعیین تکلیف کنید', 'HAS_SETTLEMENTS');
  await prisma.expense.delete({ where: { id: e.id } });
  const u = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  await log(e.groupId, req.userId, 'expense_deleted', `${u.fullName} هزینه «${e.title}» (${formatToman(Number(e.totalAmount))}) را حذف کرد`);
  res.json({ ok: true });
}));

/* ---------------- settlements ---------------- */
r.get('/groups/:id/settlements', auth, wrap(async (req, res) => { await requireMember(req.params.id, req.userId); res.json(json(await prisma.settlement.findMany({ where: { groupId: req.params.id }, orderBy: { submittedAt: 'desc' } }))); }));
r.post('/settlements', auth, wrap(async (req, res) => {
  const b = parse(z.object({ groupId: z.string(), toUser: z.string(), amount: z.number().int().positive(), receiptImageUrl: z.string().nullable().optional(), note: z.string().nullable().optional() }), req.body);
  await requireMember(b.groupId, req.userId); await requireMember(b.groupId, b.toUser);
  if (b.toUser === req.userId) throw bad('نمی‌توانید به خودتان پرداخت کنید');
  const s = await prisma.settlement.create({ data: { groupId: b.groupId, fromUser: req.userId, toUser: b.toUser, amount: BigInt(b.amount), receiptImageUrl: b.receiptImageUrl, note: b.note } });
  const [u, to] = await Promise.all([prisma.user.findUniqueOrThrow({ where: { id: req.userId } }), prisma.user.findUniqueOrThrow({ where: { id: b.toUser } })]);
  await log(b.groupId, req.userId, 'settlement_submitted', `${u.fullName} پرداخت ${formatToman(b.amount)} به ${to.fullName} را ثبت کرد (در انتظار تأیید)`, { settlementId: s.id });
  sendPush(b.toUser, 'پرداخت جدید برای تأیید', `${u.fullName} ${formatToman(b.amount)} برایت واریز کرده — تأیید کن`).catch(() => {});
  res.status(201).json(json(s));
}));
r.post('/settlements/:id/confirm', auth, wrap(async (req, res) => {
  const s = await prisma.settlement.findUnique({ where: { id: req.params.id } });
  if (!s || s.status !== 'pending_confirmation') throw bad('این پرداخت قابل تأیید نیست', 'BAD_STATE');
  if (s.toUser !== req.userId) throw forbidden('فقط دریافت‌کننده می‌تواند تأیید کند');
  await prisma.settlement.update({ where: { id: s.id }, data: { status: 'confirmed', confirmedAt: new Date() } });
  const [u, from] = await Promise.all([prisma.user.findUniqueOrThrow({ where: { id: req.userId } }), prisma.user.findUniqueOrThrow({ where: { id: s.fromUser } })]);
  await log(s.groupId, req.userId, 'settlement_confirmed', `${u.fullName} دریافت ${formatToman(Number(s.amount))} از ${from.fullName} را تأیید کرد`, { settlementId: s.id });
  sendPush(s.fromUser, 'پرداختت تأیید شد ✅', `${u.fullName} دریافت ${formatToman(Number(s.amount))} را تأیید کرد`).catch(() => {});
  res.json({ ok: true });
}));
r.post('/settlements/:id/reject', auth, wrap(async (req, res) => {
  const b = parse(z.object({ reason: z.string().min(1) }), req.body);
  const s = await prisma.settlement.findUnique({ where: { id: req.params.id } });
  if (!s || s.status !== 'pending_confirmation') throw bad('این پرداخت قابل رد نیست', 'BAD_STATE');
  if (s.toUser !== req.userId) throw forbidden('فقط دریافت‌کننده می‌تواند رد کند');
  await prisma.settlement.update({ where: { id: s.id }, data: { status: 'rejected', rejectReason: b.reason } });
  const [u, from] = await Promise.all([prisma.user.findUniqueOrThrow({ where: { id: req.userId } }), prisma.user.findUniqueOrThrow({ where: { id: s.fromUser } })]);
  await log(s.groupId, req.userId, 'settlement_rejected', `${u.fullName} پرداخت ${formatToman(Number(s.amount))} از ${from.fullName} را رد کرد: «${b.reason}»`, { settlementId: s.id });
  sendPush(s.fromUser, 'پرداختت رد شد', `${u.fullName}: ${b.reason}`).catch(() => {});
  res.json({ ok: true });
}));
r.delete('/settlements/:id', auth, wrap(async (req, res) => {
  const s = await prisma.settlement.findUnique({ where: { id: req.params.id } });
  if (!s || s.status !== 'pending_confirmation' || s.fromUser !== req.userId) throw bad('قابل لغو نیست', 'BAD_STATE');
  await prisma.settlement.delete({ where: { id: s.id } }); res.json({ ok: true });
}));

/* ---------------- reminders ---------------- */
r.post('/reminders', auth, wrap(async (req, res) => {
  const b = parse(z.object({ groupId: z.string(), targetUserId: z.string(), amount: z.number().int().positive(), frequency: z.enum(['once', 'every_1_day', 'every_2_days', 'every_3_days', 'weekly']).optional() }), req.body);
  await requireMember(b.groupId, req.userId);
  const existing = await prisma.reminder.findUnique({ where: { groupId_targetUserId: { groupId: b.groupId, targetUserId: b.targetUserId } } });
  if (existing?.lastSentAt && Date.now() - existing.lastSentAt.getTime() < 86400000) throw bad('روزی فقط یک یادآوری می‌توانید بفرستید', 'RATE_LIMIT');
  const rem = await prisma.reminder.upsert({ where: { groupId_targetUserId: { groupId: b.groupId, targetUserId: b.targetUserId } }, create: { groupId: b.groupId, targetUserId: b.targetUserId, createdBy: req.userId, frequency: b.frequency ?? 'every_3_days', lastSentAt: new Date() }, update: { lastSentAt: new Date(), active: true, ...(b.frequency ? { frequency: b.frequency } : {}) } });
  const [u, t] = await Promise.all([prisma.user.findUniqueOrThrow({ where: { id: req.userId } }), prisma.user.findUniqueOrThrow({ where: { id: b.targetUserId } })]);
  await log(b.groupId, req.userId, 'reminder_sent', `${u.fullName} برای ${t.fullName} یادآوری بدهی ${formatToman(b.amount)} فرستاد`);
  sendPush(b.targetUserId, 'یادآوری دُنگ 🔔', `${t.fullName}، ${formatToman(b.amount)} به ${u.fullName} بدهکاری`).catch(() => {});
  res.json(rem);
}));
r.patch('/reminders/:id', auth, wrap(async (req, res) => {
  const b = parse(z.object({ active: z.boolean().optional(), frequency: z.enum(['once', 'every_1_day', 'every_2_days', 'every_3_days', 'weekly']).optional() }), req.body);
  const rem = await prisma.reminder.findUnique({ where: { id: req.params.id } }); if (!rem) throw notFound();
  if (rem.createdBy !== req.userId) throw forbidden();
  res.json(await prisma.reminder.update({ where: { id: rem.id }, data: b }));
}));
r.delete('/reminders/:id', auth, wrap(async (req, res) => {
  const rem = await prisma.reminder.findUnique({ where: { id: req.params.id } }); if (!rem) throw notFound();
  if (rem.createdBy !== req.userId) throw forbidden();
  await prisma.reminder.delete({ where: { id: rem.id } }); res.json({ ok: true });
}));
