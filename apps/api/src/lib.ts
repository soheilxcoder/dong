import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { getMembership } from './db.js';

export const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me';

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export const bad = (msg: string, code = 'BAD_REQUEST') => new HttpError(400, code, msg);
export const forbidden = (msg = 'دسترسی ندارید') => new HttpError(403, 'FORBIDDEN', msg);
export const notFound = (msg = 'پیدا نشد') => new HttpError(404, 'NOT_FOUND', msg);

export interface AuthedRequest extends Request { userId: string }

export function signToken(userId: string) { return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '180d' }); }

export function auth(req: Request, _res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return next(new HttpError(401, 'UNAUTHENTICATED', 'ابتدا وارد شوید'));
  try { (req as AuthedRequest).userId = String((jwt.verify(h.slice(7), JWT_SECRET) as { sub: string }).sub); next(); }
  catch { next(new HttpError(401, 'UNAUTHENTICATED', 'نشست نامعتبر است')); }
}

export const wrap = (fn: (req: AuthedRequest, res: Response) => unknown | Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve().then(() => fn(req as AuthedRequest, res)).catch(next);

export function parse<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) throw bad(r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('، '), 'VALIDATION');
  return r.data;
}

export const token = () => crypto.randomBytes(9).toString('base64url');

export function requireMember(groupId: string, userId: string) {
  const m = getMembership(groupId, userId);
  if (!m) throw forbidden('شما عضو این گروه نیستید');
  return m;
}
