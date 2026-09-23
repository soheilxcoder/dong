import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';

export const prisma = new PrismaClient();
export const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me';

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export const bad = (msg: string, code = 'BAD_REQUEST') => new HttpError(400, code, msg);
export const forbidden = (msg = 'دسترسی ندارید') => new HttpError(403, 'FORBIDDEN', msg);
export const notFound = (msg = 'پیدا نشد') => new HttpError(404, 'NOT_FOUND', msg);

export interface AuthedRequest extends Request { userId: string }

export function signToken(userId: string) { return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '90d' }); }

export function auth(req: Request, _res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return next(new HttpError(401, 'UNAUTHENTICATED', 'ابتدا وارد شوید'));
  try { (req as AuthedRequest).userId = String((jwt.verify(h.slice(7), JWT_SECRET) as { sub: string }).sub); next(); }
  catch { next(new HttpError(401, 'UNAUTHENTICATED', 'نشست نامعتبر است')); }
}

export const wrap = (fn: (req: AuthedRequest, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req as AuthedRequest, res).catch(next);

export function parse<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) throw bad(r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('، '), 'VALIDATION');
  return r.data;
}

export const token = () => crypto.randomBytes(9).toString('base64url');

/** BigInt-safe JSON: amounts are serialised as numbers (safe under 2^53 toman). */
export function json(v: unknown) {
  return JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? Number(x) : x)));
}

export async function requireMember(groupId: string, userId: string) {
  const m = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
  if (!m) throw forbidden('شما عضو این گروه نیستید');
  return m;
}

export async function log(groupId: string, actorId: string, actionType: string, description: string, meta?: object) {
  await prisma.activityLog.create({ data: { groupId, actorId, actionType, description, meta: meta as never } });
}

export function toCoreExpense(e: { id: string; groupId: string; title: string; totalAmount: bigint; paidBy: string; paidAt: Date; splitType: string; status: string; createdBy: string; createdAt: Date; participants: { userId: string; amountOwed: bigint }[] }) {
  return { ...e, totalAmount: Number(e.totalAmount), paidAt: e.paidAt.toISOString(), createdAt: e.createdAt.toISOString(), splitType: e.splitType as 'equal', status: e.status as 'open', participants: e.participants.map((p) => ({ userId: p.userId, amountOwed: Number(p.amountOwed) })) };
}
export function toCoreSettlement(s: { id: string; groupId: string; fromUser: string; toUser: string; amount: bigint; status: string; submittedAt: Date }) {
  return { ...s, amount: Number(s.amount), status: s.status as 'confirmed', submittedAt: s.submittedAt.toISOString() };
}
