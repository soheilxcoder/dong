import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import QRCode from 'qrcode';
import { computeNetBalances, simplifyDebts, normalizeCardNumber, formatToman } from '@dong/core';
import { auth, bad, forbidden, notFound, parse, requireMember, signToken, token, wrap } from './lib.js';
import { type DbSettlement, all, expensesOf, getGroup, getGroupByToken, getMembership, getUser, getUserByName, groupDetail, log, memberIds, membersOf, now, one, run, safeUser, settlementsOf, tx, uid } from './db.js';
import { sendPush, pushChannels } from './push.js';

export const r = Router();
const userName = (id: string) => getUser(id)?.fullName ?? 'کاربر';

/* ---------------- auth ---------------- */
r.post('/auth/register', wrap(async (req, res) => {
  const b = parse(z.object({ fullName: z.string().min(2), username: z.string().regex(/^[a-z0-9_]{3,20}$/i), password: z.string().min(4), securityQuestion: z.string().optional(), securityAnswer: z.string().optional(), cardNumber: z.string().optional() }), req.body);
  const username = b.username.toLowerCase();
  if (getUserByName(username)) throw bad('این نام کاربری قبلاً گرفته شده', 'USERNAME_TAKEN');
  const card = b.cardNumber ? normalizeCardNumber(b.cardNumber) : null;
  if (card && !/^\d{16}$/.test(card)) throw bad('شماره کارت باید ۱۶ رقم باشد');
  const id = uid(); const t = now();
  run('INSERT INTO users (id, fullName, username, passwordHash, securityQuestion, securityAnswerHash, cardNumber, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?)',
    id, b.fullName.trim(), username, await bcrypt.hash(b.password, 10), b.securityQuestion?.trim() || null, b.securityAnswer ? await bcrypt.hash(b.securityAnswer.trim(), 10) : null, card, t, t);
  res.status(201).json({ user: safeUser(getUser(id)!), token: signToken(id) });
}));
r.post('/auth/login', wrap(async (req, res) => {
  const b = parse(z.object({ username: z.string(), password: z.string() }), req.body);
  const u = getUserByName(b.username);
  if (!u || !(await bcrypt.compare(b.password, u.passwordHash))) throw bad('نام کاربری یا رمز عبور اشتباه است', 'BAD_CREDENTIALS');
  res.json({ user: safeUser(u), token: signToken(u.id) });
}));
r.get('/auth/security-question/:username', wrap((req, res) => { res.json({ question: getUserByName(req.params.username)?.securityQuestion ?? null }); }));
r.post('/auth/reset-password-with-security-answer', wrap(async (req, res) => {
  const b = parse(z.object({ username: z.string(), answer: z.string(), newPassword: z.string().min(4) }), req.body);
  const u = getUserByName(b.username);
  if (!u?.securityAnswerHash || !(await bcrypt.compare(b.answer.trim(), u.securityAnswerHash))) throw bad('پاسخ سؤال امنیتی اشتباه است', 'BAD_ANSWER');
  run('UPDATE users SET passwordHash = ?, updatedAt = ? WHERE id = ?', await bcrypt.hash(b.newPassword, 10), now(), u.id);
  res.json({ ok: true });
}));

/* ---------------- users ---------------- */
r.get('/users/me', auth, wrap((req, res) => { const u = getUser(req.userId); if (!u) throw notFound('کاربر پیدا نشد'); res.json(safeUser(u)); }));
r.patch('/users/me', auth, wrap((req, res) => {
  const b = parse(z.object({ fullName: z.string().min(2).optional(), avatarUrl: z.string().nullable().optional(), cardNumber: z.string().nullable().optional(), cardHolderName: z.string().nullable().optional() }), req.body);
  if (b.cardNumber) { b.cardNumber = normalizeCardNumber(b.cardNumber); if (!/^\d{16}$/.test(b.cardNumber)) throw bad('شماره کارت باید ۱۶ رقم باشد'); }
  const u = getUser(req.userId)!;
  run('UPDATE users SET fullName = ?, avatarUrl = ?, cardNumber = ?, cardHolderName = ?, updatedAt = ? WHERE id = ?',
    b.fullName ?? u.fullName, b.avatarUrl === undefined ? u.avatarUrl : b.avatarUrl, b.cardNumber === undefined ? u.cardNumber : b.cardNumber, b.cardHolderName === undefined ? u.cardHolderName : b.cardHolderName, now(), u.id);
  res.json(safeUser(getUser(u.id)!));
}));
r.post('/users/me/password', auth, wrap(async (req, res) => {
  const b = parse(z.object({ oldPassword: z.string(), newPassword: z.string().min(4) }), req.body);
  const u = getUser(req.userId)!;
  if (!(await bcrypt.compare(b.oldPassword, u.passwordHash))) throw bad('رمز فعلی اشتباه است', 'BAD_CREDENTIALS');
  run('UPDATE users SET passwordHash = ?, updatedAt = ? WHERE id = ?', await bcrypt.hash(b.newPassword, 10), now(), u.id);
  res.json({ ok: true });
}));
/** Register a push target: either a Web Push subscription {endpoint, keys} or an Android FCM device token {fcmToken}. */
r.post('/users/me/push', auth, wrap((req, res) => {
  const b = parse(z.union([
    z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string(), auth: z.string() }) }),
    z.object({ fcmToken: z.string().min(10) }),
  ]), req.body);
  const endpoint = 'fcmToken' in b ? `fcm:${b.fcmToken}` : b.endpoint;
  const keys = 'fcmToken' in b ? '{}' : JSON.stringify(b.keys);
  run('INSERT INTO push_subscriptions (id, userId, endpoint, keys, createdAt) VALUES (?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET userId = excluded.userId, keys = excluded.keys', uid(), req.userId, endpoint, keys, now());
  res.json({ ok: true, channels: pushChannels() });
}));
/** Unregister this device (called on logout so the next user of the phone doesn't get someone else's notifications). */
r.delete('/users/me/push', auth, wrap((req, res) => {
  const b = parse(z.object({ endpoint: z.string().optional(), fcmToken: z.string().optional() }), req.body ?? {});
  const endpoint = b.fcmToken ? `fcm:${b.fcmToken}` : b.endpoint;
  if (endpoint) run('DELETE FROM push_subscriptions WHERE endpoint = ? AND userId = ?', endpoint, req.userId);
  res.json({ ok: true });
}));
/** Inbox for the app's own background poller: everything after `since` (ISO), newest last, max 50. */
r.get('/users/me/notifications', auth, wrap((req, res) => {
  const since = typeof req.query.since === 'string' && req.query.since ? req.query.since : new Date(Date.now() - 7 * 86400000).toISOString();
  res.json(all('SELECT id, title, body, groupId, createdAt FROM notifications WHERE userId = ? AND createdAt > ? ORDER BY createdAt ASC LIMIT 50', req.userId, since));
}));
r.get('/push/config', wrap((_req, res) => res.json({ channels: pushChannels(), vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? null })));

/* ---------------- groups ---------------- */
const balancesOf = (groupId: string) => {
  const balances = computeNetBalances(memberIds(groupId), expensesOf(groupId) as never, settlementsOf(groupId) as never);
  return { balances, transfers: simplifyDebts(balances), pending: settlementsOf(groupId).filter((s) => s.status === 'pending_confirmation') };
};
const detailOr404 = (id: string) => { const d = groupDetail(id); if (!d) throw notFound('گروه پیدا نشد'); return d; };

r.get('/groups', auth, wrap((req, res) => {
  const ids = all<{ groupId: string }>('SELECT groupId FROM memberships WHERE userId = ? ORDER BY joinedAt DESC', req.userId).map((m) => m.groupId);
  res.json(ids.map((id) => groupDetail(id)).filter(Boolean));
}));
r.post('/groups', auth, wrap((req, res) => {
  const b = parse(z.object({ name: z.string().min(2), description: z.string().nullable().optional(), coverImageUrl: z.string().nullable().optional() }), req.body);
  const id = uid(); const t = now();
  tx(() => {
    run('INSERT INTO groups (id, name, description, coverImageUrl, createdBy, inviteToken, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?)', id, b.name.trim(), b.description ?? null, b.coverImageUrl ?? null, req.userId, token(), t, t);
    run('INSERT INTO memberships (id, groupId, userId, role, joinedAt, updatedAt) VALUES (?,?,?,?,?,?)', uid(), id, req.userId, 'owner', t, t);
    log(id, req.userId, 'group_created', `${userName(req.userId)} گروه «${b.name.trim()}» را ساخت`);
  });
  res.status(201).json(getGroup(id));
}));
r.get('/groups/invite/:token', wrap((req, res) => {
  const g = getGroupByToken(req.params.token);
  if (!g) throw notFound('لینک دعوت نامعتبر است');
  res.json({ group: g, memberCount: memberIds(g.id).length });
}));
r.post('/groups/join/:token', auth, wrap((req, res) => {
  const g = getGroupByToken(req.params.token);
  if (!g) throw notFound('لینک دعوت نامعتبر است');
  const gid = g.id;
  if (!getMembership(gid, req.userId)) {
    const t = now();
    tx(() => {
      run('INSERT INTO memberships (id, groupId, userId, role, joinedAt, updatedAt) VALUES (?,?,?,?,?,?)', uid(), gid, req.userId, 'member', t, t);
      log(gid, req.userId, 'member_joined', `${userName(req.userId)} به گروه پیوست`);
    });
    for (const m of memberIds(gid)) if (m !== req.userId) sendPush(m, 'عضو جدید در دُنگ', `${userName(req.userId)} به «${g.name}» پیوست`, gid).catch(() => {});
  }
  res.json(g);
}));
r.get('/groups/:id', auth, wrap((req, res) => { requireMember(req.params.id, req.userId); res.json(detailOr404(req.params.id)); }));
r.patch('/groups/:id', auth, wrap((req, res) => {
  if (requireMember(req.params.id, req.userId).role !== 'owner') throw forbidden('فقط مالک گروه می‌تواند ویرایش کند');
  const b = parse(z.object({ name: z.string().min(2).optional(), description: z.string().nullable().optional(), coverImageUrl: z.string().nullable().optional() }), req.body);
  const g = getGroup(req.params.id)!;
  run('UPDATE groups SET name = ?, description = ?, coverImageUrl = ?, updatedAt = ? WHERE id = ?', b.name ?? g.name, b.description === undefined ? g.description : b.description, b.coverImageUrl === undefined ? g.coverImageUrl : b.coverImageUrl, now(), g.id);
  res.json(getGroup(req.params.id));
}));
r.post('/groups/:id/invite/regenerate', auth, wrap((req, res) => {
  if (requireMember(req.params.id, req.userId).role !== 'owner') throw forbidden();
  const t = token();
  run('UPDATE groups SET inviteToken = ?, updatedAt = ? WHERE id = ?', t, now(), req.params.id);
  res.json({ inviteToken: t });
}));
r.get('/groups/:id/invite-qr', auth, wrap(async (req, res) => {
  requireMember(req.params.id, req.userId);
  const g = getGroup(req.params.id)!;
  const url = `${(process.env.PUBLIC_APP_URL ?? 'http://localhost:4000/').replace(/\/?$/, '/')}#/join/${g.inviteToken}`;
  res.json({ url, qr: await QRCode.toDataURL(url, { margin: 1, width: 512 }) });
}));
r.get('/groups/:id/balances', auth, wrap((req, res) => { requireMember(req.params.id, req.userId); res.json(balancesOf(req.params.id)); }));
r.get('/groups/:id/activity', auth, wrap((req, res) => {
  requireMember(req.params.id, req.userId);
  res.json(all('SELECT * FROM activity WHERE groupId = ? ORDER BY createdAt DESC LIMIT 300', req.params.id).map((a) => ({ ...a, meta: a.meta ? JSON.parse(String(a.meta)) : undefined })));
}));
r.get('/activity', auth, wrap((req, res) => {
  res.json(all('SELECT a.* FROM activity a JOIN memberships m ON m.groupId = a.groupId AND m.userId = ? ORDER BY a.createdAt DESC LIMIT 300', req.userId).map((a) => ({ ...a, meta: a.meta ? JSON.parse(String(a.meta)) : undefined })));
}));
const assertSettled = (groupId: string, userId: string) => {
  const { balances, pending } = balancesOf(groupId);
  if ((balances.find((b) => b.userId === userId)?.balance ?? 0) !== 0) throw bad('ابتدا حساب‌ها را تسویه کنید', 'UNSETTLED');
  if (pending.some((s) => s.fromUser === userId || s.toUser === userId)) throw bad('یک پرداخت در انتظار تأیید وجود دارد', 'PENDING');
};
r.delete('/groups/:id/members/:userId', auth, wrap((req, res) => {
  const me = requireMember(req.params.id, req.userId);
  const self = req.params.userId === req.userId;
  if (!self && me.role !== 'owner') throw forbidden('فقط مالک گروه می‌تواند عضو حذف کند');
  if (!getMembership(req.params.id, req.params.userId)) throw notFound('عضو پیدا نشد');
  assertSettled(req.params.id, req.params.userId);
  tx(() => {
    run('DELETE FROM memberships WHERE groupId = ? AND userId = ?', req.params.id, req.params.userId);
    log(req.params.id, req.userId, self ? 'member_left' : 'member_removed', self ? `${userName(req.userId)} از گروه خارج شد` : `${userName(req.userId)} ${userName(req.params.userId)} را از گروه حذف کرد`);
  });
  res.json({ ok: true });
}));

/* ---------------- expenses ---------------- */
const expenseSchema = z.object({
  title: z.string().min(1), totalAmount: z.number().int().positive(), paidBy: z.string(), paidAt: z.string(),
  splitType: z.enum(['equal', 'custom', 'by_payer']), participants: z.array(z.object({ userId: z.string(), amountOwed: z.number().int().nonnegative() })).min(1),
  receiptImageUrl: z.string().nullable().optional(), notes: z.string().nullable().optional(),
});
const validateExpense = (groupId: string, b: z.infer<typeof expenseSchema>) => {
  const sum = b.participants.reduce((s, p) => s + p.amountOwed, 0);
  if (sum !== b.totalAmount) throw bad(`مجموع سهم‌ها (${formatToman(sum)}) با مبلغ کل برابر نیست`, 'SUM_MISMATCH');
  const ids = new Set(memberIds(groupId));
  if (!ids.has(b.paidBy) || b.participants.some((p) => !ids.has(p.userId))) throw bad('همه شرکت‌کننده‌ها باید عضو گروه باشند');
  if (Number.isNaN(Date.parse(b.paidAt))) throw bad('تاریخ نامعتبر است');
};
const expenseById = (id: string) => expensesOf((one<{ groupId: string }>('SELECT groupId FROM expenses WHERE id = ?', id)?.groupId) ?? '').find((e) => e.id === id);
const writeParticipants = (expenseId: string, ps: { userId: string; amountOwed: number }[]) => {
  run('DELETE FROM expense_participants WHERE expenseId = ?', expenseId);
  for (const p of ps) run('INSERT INTO expense_participants (expenseId, userId, amountOwed) VALUES (?,?,?)', expenseId, p.userId, p.amountOwed);
};
r.get('/groups/:id/expenses', auth, wrap((req, res) => { requireMember(req.params.id, req.userId); res.json(expensesOf(req.params.id)); }));
r.post('/groups/:id/expenses', auth, wrap((req, res) => {
  requireMember(req.params.id, req.userId);
  const b = parse(expenseSchema, req.body); validateExpense(req.params.id, b);
  const id = uid(); const t = now();
  tx(() => {
    run('INSERT INTO expenses (id, groupId, title, totalAmount, paidBy, paidAt, splitType, receiptImageUrl, notes, status, createdBy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      id, req.params.id, b.title.trim(), b.totalAmount, b.paidBy, new Date(b.paidAt).toISOString(), b.splitType, b.receiptImageUrl ?? null, b.notes ?? null, 'open', req.userId, t, t);
    writeParticipants(id, b.participants);
    log(req.params.id, req.userId, 'expense_created', `${userName(req.userId)} هزینه «${b.title.trim()}» به مبلغ ${formatToman(b.totalAmount)} ثبت کرد`, { expenseId: id });
  });
  for (const p of b.participants) if (p.userId !== req.userId) sendPush(p.userId, 'هزینه جدید در دُنگ', `${userName(req.userId)}: «${b.title}» — سهم شما ${formatToman(p.amountOwed)}`, req.params.id).catch(() => {});
  res.status(201).json(expenseById(id));
}));
r.patch('/expenses/:id', auth, wrap((req, res) => {
  const old = expenseById(req.params.id); if (!old) throw notFound();
  const m = requireMember(old.groupId, req.userId);
  if (old.createdBy !== req.userId && m.role !== 'owner') throw forbidden('فقط ثبت‌کننده یا مالک گروه می‌تواند ویرایش کند');
  const b = parse(expenseSchema, req.body); validateExpense(old.groupId, b);
  tx(() => {
    run('UPDATE expenses SET title = ?, totalAmount = ?, paidBy = ?, paidAt = ?, splitType = ?, receiptImageUrl = ?, notes = ?, updatedAt = ? WHERE id = ?',
      b.title.trim(), b.totalAmount, b.paidBy, new Date(b.paidAt).toISOString(), b.splitType, b.receiptImageUrl ?? null, b.notes ?? null, now(), old.id);
    writeParticipants(old.id, b.participants);
    log(old.groupId, req.userId, 'expense_updated', Number(old.totalAmount) !== b.totalAmount ? `${userName(req.userId)} مبلغ «${b.title}» را از ${formatToman(Number(old.totalAmount))} به ${formatToman(b.totalAmount)} ویرایش کرد` : `${userName(req.userId)} هزینه «${b.title}» را ویرایش کرد`, { expenseId: old.id });
  });
  res.json(expenseById(old.id));
}));
r.delete('/expenses/:id', auth, wrap((req, res) => {
  const e = expenseById(req.params.id); if (!e) throw notFound();
  const m = requireMember(e.groupId, req.userId);
  if (e.createdBy !== req.userId && m.role !== 'owner') throw forbidden('فقط ثبت‌کننده یا مالک گروه می‌تواند حذف کند');
  if (settlementsOf(e.groupId).some((s) => s.status === 'pending_confirmation')) throw bad('پرداخت در انتظار تأیید وجود دارد؛ ابتدا آن‌ها را تعیین تکلیف کنید', 'HAS_SETTLEMENTS');
  tx(() => {
    run('DELETE FROM expenses WHERE id = ?', e.id);
    log(e.groupId, req.userId, 'expense_deleted', `${userName(req.userId)} هزینه «${e.title}» (${formatToman(Number(e.totalAmount))}) را حذف کرد`);
  });
  res.json({ ok: true });
}));

/* ---------------- settlements ---------------- */
const settlement = (id: string) => one<DbSettlement>('SELECT * FROM settlements WHERE id = ?', id);
r.get('/groups/:id/settlements', auth, wrap((req, res) => { requireMember(req.params.id, req.userId); res.json(settlementsOf(req.params.id)); }));
r.post('/settlements', auth, wrap((req, res) => {
  const b = parse(z.object({ groupId: z.string(), toUser: z.string(), amount: z.number().int().positive(), receiptImageUrl: z.string().nullable().optional(), note: z.string().nullable().optional(), fromUser: z.string().optional() }), req.body);
  requireMember(b.groupId, req.userId); requireMember(b.groupId, b.toUser);
  const from = b.fromUser && b.fromUser !== req.userId ? b.fromUser : req.userId;
  if (from !== req.userId) requireMember(b.groupId, from);
  if (b.toUser === from) throw bad('نمی‌توانید به خودتان پرداخت کنید');
  const id = uid(); const t = now();
  // creditor recording a payment they received from someone => auto-confirmed
  const auto = b.toUser === req.userId;
  tx(() => {
    run('INSERT INTO settlements (id, groupId, fromUser, toUser, amount, receiptImageUrl, status, note, submittedAt, confirmedAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      id, b.groupId, from, b.toUser, b.amount, b.receiptImageUrl ?? null, auto ? 'confirmed' : 'pending_confirmation', b.note ?? null, t, auto ? t : null, t);
    log(b.groupId, req.userId, auto ? 'settlement_confirmed' : 'settlement_submitted', auto ? `${userName(req.userId)} دریافت ${formatToman(b.amount)} از ${userName(from)} را ثبت کرد` : `${userName(from)} پرداخت ${formatToman(b.amount)} به ${userName(b.toUser)} را ثبت کرد (در انتظار تأیید)`, { settlementId: id });
  });
  if (!auto) sendPush(b.toUser, 'پرداخت جدید برای تأیید', `${userName(from)} ${formatToman(b.amount)} برایت واریز کرده — تأیید کن`, b.groupId).catch(() => {});
  res.status(201).json(settlement(id));
}));
r.post('/settlements/:id/confirm', auth, wrap((req, res) => {
  const s = settlement(req.params.id);
  if (!s || s.status !== 'pending_confirmation') throw bad('این پرداخت قابل تأیید نیست', 'BAD_STATE');
  if (s.toUser !== req.userId) throw forbidden('فقط دریافت‌کننده می‌تواند تأیید کند');
  tx(() => {
    run('UPDATE settlements SET status = ?, confirmedAt = ?, updatedAt = ? WHERE id = ?', 'confirmed', now(), now(), s.id);
    log(s.groupId, req.userId, 'settlement_confirmed', `${userName(req.userId)} دریافت ${formatToman(Number(s.amount))} از ${userName(s.fromUser)} را تأیید کرد`, { settlementId: s.id });
  });
  sendPush(s.fromUser, 'پرداختت تأیید شد ✅', `${userName(req.userId)} دریافت ${formatToman(Number(s.amount))} را تأیید کرد`, s.groupId).catch(() => {});
  res.json({ ok: true });
}));
r.post('/settlements/:id/reject', auth, wrap((req, res) => {
  const b = parse(z.object({ reason: z.string().min(1) }), req.body);
  const s = settlement(req.params.id);
  if (!s || s.status !== 'pending_confirmation') throw bad('این پرداخت قابل رد نیست', 'BAD_STATE');
  if (s.toUser !== req.userId) throw forbidden('فقط دریافت‌کننده می‌تواند رد کند');
  tx(() => {
    run('UPDATE settlements SET status = ?, rejectReason = ?, updatedAt = ? WHERE id = ?', 'rejected', b.reason, now(), s.id);
    log(s.groupId, req.userId, 'settlement_rejected', `${userName(req.userId)} پرداخت ${formatToman(Number(s.amount))} از ${userName(s.fromUser)} را رد کرد: «${b.reason}»`, { settlementId: s.id });
  });
  sendPush(s.fromUser, 'پرداختت رد شد', `${userName(req.userId)}: ${b.reason}`, s.groupId).catch(() => {});
  res.json({ ok: true });
}));
r.delete('/settlements/:id', auth, wrap((req, res) => {
  const s = settlement(req.params.id);
  if (!s || s.status !== 'pending_confirmation' || s.fromUser !== req.userId) throw bad('قابل لغو نیست', 'BAD_STATE');
  run('DELETE FROM settlements WHERE id = ?', s.id); res.json({ ok: true });
}));

/* ---------------- reminders ---------------- */
r.get('/groups/:id/reminders', auth, wrap((req, res) => { requireMember(req.params.id, req.userId); res.json(all('SELECT * FROM reminders WHERE groupId = ?', req.params.id).map((x) => ({ ...x, active: !!x.active }))); }));
r.post('/reminders', auth, wrap((req, res) => {
  const b = parse(z.object({ groupId: z.string(), targetUserId: z.string(), amount: z.number().int().positive(), frequency: z.enum(['once', 'every_1_day', 'every_2_days', 'every_3_days', 'weekly']).optional() }), req.body);
  requireMember(b.groupId, req.userId); requireMember(b.groupId, b.targetUserId);
  const existing = one('SELECT * FROM reminders WHERE groupId = ? AND targetUserId = ?', b.groupId, b.targetUserId);
  if (existing?.lastSentAt && Date.now() - Date.parse(String(existing.lastSentAt)) < 86400000) throw bad('روزی فقط یک یادآوری می‌توانید بفرستید', 'RATE_LIMIT');
  tx(() => {
    if (existing) run('UPDATE reminders SET lastSentAt = ?, active = 1, frequency = ? WHERE id = ?', now(), b.frequency ?? existing.frequency, existing.id);
    else run('INSERT INTO reminders (id, groupId, targetUserId, createdBy, frequency, active, lastSentAt, createdAt) VALUES (?,?,?,?,?,1,?,?)', uid(), b.groupId, b.targetUserId, req.userId, b.frequency ?? 'every_3_days', now(), now());
    log(b.groupId, req.userId, 'reminder_sent', `${userName(req.userId)} برای ${userName(b.targetUserId)} یادآوری بدهی ${formatToman(b.amount)} فرستاد`);
  });
  sendPush(b.targetUserId, 'یادآوری دُنگ 🔔', `${userName(b.targetUserId)}، ${formatToman(b.amount)} به ${userName(req.userId)} بدهکاری`, b.groupId).catch(() => {});
  res.json(one('SELECT * FROM reminders WHERE groupId = ? AND targetUserId = ?', b.groupId, b.targetUserId));
}));
