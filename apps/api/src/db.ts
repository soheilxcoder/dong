/**
 * Persistence: SQLite through Node's built-in `node:sqlite` (Node ≥ 22.13). No native modules,
 * no external database server — one file (`DATABASE_FILE`, default ./data/dong.db) that you back up by copying.
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const file = process.env.DATABASE_FILE ?? './data/dong.db';
fs.mkdirSync(path.dirname(file), { recursive: true });
export const db = new DatabaseSync(file);
db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;`);

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, fullName TEXT NOT NULL, username TEXT NOT NULL UNIQUE, passwordHash TEXT NOT NULL,
  securityQuestion TEXT, securityAnswerHash TEXT, avatarUrl TEXT, cardNumber TEXT, cardHolderName TEXT,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, coverImageUrl TEXT, createdBy TEXT NOT NULL REFERENCES users(id),
  inviteToken TEXT NOT NULL UNIQUE, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY, groupId TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE, userId TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'member', joinedAt TEXT NOT NULL, updatedAt TEXT NOT NULL, UNIQUE(groupId, userId)
);
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY, groupId TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE, title TEXT NOT NULL, totalAmount INTEGER NOT NULL,
  paidBy TEXT NOT NULL, paidAt TEXT NOT NULL, splitType TEXT NOT NULL, receiptImageUrl TEXT, notes TEXT, status TEXT NOT NULL DEFAULT 'open',
  createdBy TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_expenses_group ON expenses(groupId);
CREATE TABLE IF NOT EXISTS expense_participants (
  expenseId TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE, userId TEXT NOT NULL, amountOwed INTEGER NOT NULL, PRIMARY KEY(expenseId, userId)
);
CREATE TABLE IF NOT EXISTS settlements (
  id TEXT PRIMARY KEY, groupId TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE, fromUser TEXT NOT NULL, toUser TEXT NOT NULL, amount INTEGER NOT NULL,
  receiptImageUrl TEXT, status TEXT NOT NULL DEFAULT 'pending_confirmation', note TEXT, rejectReason TEXT,
  submittedAt TEXT NOT NULL, confirmedAt TEXT, updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_settlements_group ON settlements(groupId);
CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY, groupId TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE, actorId TEXT NOT NULL, type TEXT NOT NULL,
  description TEXT NOT NULL, meta TEXT, createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_activity_group ON activity(groupId, createdAt);
CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY, groupId TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE, targetUserId TEXT NOT NULL, createdBy TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'every_3_days', active INTEGER NOT NULL DEFAULT 1, lastSentAt TEXT, createdAt TEXT NOT NULL, UNIQUE(groupId, targetUserId)
);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, body TEXT NOT NULL,
  groupId TEXT, createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_notifications_user ON notifications(userId, createdAt);
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, endpoint TEXT NOT NULL UNIQUE, keys TEXT NOT NULL, createdAt TEXT NOT NULL
);
`);

export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();

type Row = Record<string, unknown>;
export const one = <T = Row>(sql: string, ...params: unknown[]) => db.prepare(sql).get(...(params as never[])) as T | undefined;
export const all = <T = Row>(sql: string, ...params: unknown[]) => db.prepare(sql).all(...(params as never[])) as T[];
export const run = (sql: string, ...params: unknown[]) => db.prepare(sql).run(...(params as never[]));
export const tx = <T>(fn: () => T): T => { db.exec('BEGIN'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };

/* ---------- typed readers (shapes match packages/core types exactly) ---------- */
export interface DbUser { id: string; fullName: string; username: string; passwordHash: string; securityQuestion: string | null; securityAnswerHash: string | null; avatarUrl: string | null; cardNumber: string | null; cardHolderName: string | null; createdAt: string; updatedAt: string }
export const safeUser = (u: DbUser) => ({ id: u.id, fullName: u.fullName, username: u.username, avatarUrl: u.avatarUrl, cardNumber: u.cardNumber, cardHolderName: u.cardHolderName, createdAt: u.createdAt, updatedAt: u.updatedAt });
export const getUser = (id: string) => one<DbUser>('SELECT * FROM users WHERE id = ?', id);
export const getUserByName = (username: string) => one<DbUser>('SELECT * FROM users WHERE username = ?', username.trim().toLowerCase());

export interface DbGroup { id: string; name: string; description: string | null; coverImageUrl: string | null; createdBy: string; inviteToken: string; createdAt: string; updatedAt: string }
export const getGroup = (id: string) => one<DbGroup>('SELECT * FROM groups WHERE id = ?', id);
export const getGroupByToken = (t: string) => one<DbGroup>('SELECT * FROM groups WHERE inviteToken = ?', t);
export const getMembership = (groupId: string, userId: string) => one<{ id: string; role: string }>('SELECT * FROM memberships WHERE groupId = ? AND userId = ?', groupId, userId);
export const memberIds = (groupId: string) => all<{ userId: string }>('SELECT userId FROM memberships WHERE groupId = ?', groupId).map((m) => m.userId);

export interface DbExpense { id: string; groupId: string; title: string; totalAmount: number; paidBy: string; paidAt: string; splitType: string; receiptImageUrl: string | null; notes: string | null; status: string; createdBy: string; createdAt: string; updatedAt: string }
export function expensesOf(groupId: string) {
  const ex = all<DbExpense>('SELECT * FROM expenses WHERE groupId = ? ORDER BY paidAt DESC, createdAt DESC', groupId);
  const parts = all<{ expenseId: string; userId: string; amountOwed: number }>('SELECT p.* FROM expense_participants p JOIN expenses e ON e.id = p.expenseId WHERE e.groupId = ?', groupId);
  return ex.map((e) => ({ ...e, participants: parts.filter((p) => p.expenseId === e.id).map((p) => ({ userId: p.userId, amountOwed: Number(p.amountOwed) })) }));
}
export interface DbSettlement { id: string; groupId: string; fromUser: string; toUser: string; amount: number; receiptImageUrl: string | null; status: string; note: string | null; rejectReason: string | null; submittedAt: string; confirmedAt: string | null; updatedAt: string }
export const settlementsOf = (groupId: string) => all<DbSettlement>('SELECT * FROM settlements WHERE groupId = ? ORDER BY submittedAt DESC', groupId);
export function membersOf(groupId: string) {
  return all<Row & { user_json: string }>(`SELECT m.*, json_object('id',u.id,'fullName',u.fullName,'username',u.username,'avatarUrl',u.avatarUrl,'cardNumber',u.cardNumber,'cardHolderName',u.cardHolderName,'createdAt',u.createdAt,'updatedAt',u.updatedAt) AS user_json
     FROM memberships m JOIN users u ON u.id = m.userId WHERE m.groupId = ? ORDER BY m.joinedAt ASC`, groupId)
    .map(({ user_json, ...m }) => ({ ...m, user: JSON.parse(user_json) }));
}
export function groupDetail(groupId: string) {
  const group = getGroup(groupId);
  if (!group) return null;
  return { group, members: membersOf(groupId), expenses: expensesOf(groupId), settlements: settlementsOf(groupId) };
}
export function log(groupId: string, actorId: string, type: string, description: string, meta?: object) {
  run('INSERT INTO activity (id, groupId, actorId, type, description, meta, createdAt) VALUES (?,?,?,?,?,?,?)', uid(), groupId, actorId, type, description, meta ? JSON.stringify(meta) : null, now());
}
