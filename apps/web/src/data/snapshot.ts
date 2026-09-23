import { deflateSync, inflateSync, strToU8, strFromU8 } from 'fflate';
import type { Activity, Expense, Group, Membership, Settlement, User } from '@dong/core';

/** Portable group snapshot embedded in invite links (serverless sharing). */
export interface Snapshot {
  v: 1;
  group: Group;
  members: (Membership & { user: User })[];
  expenses: Expense[];
  settlements: Settlement[];
  activity: Activity[];
  /** ids of deleted expenses / settlements (tombstones) */
  deleted?: { id: string; at: string; kind: 'expense' | 'settlement' }[];
  /** for invite links: only a slim copy; relay sync sends `full` */
  full?: boolean;
}

const b64url = (bytes: Uint8Array) => {
  let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64url = (s: string) => {
  const clean = s.replace(/[^A-Za-z0-9\-_]/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(clean.padEnd(Math.ceil(clean.length / 4) * 4, '='));
  const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

/** Strip heavy fields (images, long activity) so the link stays short and QR scannable. */
export function encodeSnapshot(s: Snapshot): string {
  const slim: Snapshot = {
    ...s,
    group: { ...s.group, coverImageUrl: null },
    members: s.members.map((m) => ({ ...m, user: { ...m.user, avatarUrl: null } })),
    expenses: s.expenses.map((e) => ({ ...e, receiptImageUrl: e.receiptImageUrl ? '__omitted__' : null })),
    settlements: s.settlements.map((x) => ({ ...x, receiptImageUrl: x.receiptImageUrl ? '__omitted__' : null })),
    activity: s.activity.slice(0, 6),
    deleted: s.deleted?.slice(-50),
  };
  return 'f' + b64url(deflateSync(strToU8(JSON.stringify(slim)), { level: 9 }));
}

export function decodeSnapshot(code: string): Snapshot | null {
  try {
    let c = code.trim();
    try { c = decodeURIComponent(c); } catch { /* keep */ }
    if (c[0] !== 'f') return null;
    const s = JSON.parse(strFromU8(inflateSync(unb64url(c.slice(1))))) as Snapshot;
    if (s.v !== 1 || !s.group?.id || !Array.isArray(s.members)) return null;
    return s;
  } catch { return null; }
}

/** Extract snapshot code from a full invite URL or raw code. */
export function extractSnapshot(input: string): string | null {
  const t = input.trim();
  const m = t.match(/[?&]s=([^&#\s]+)/);
  if (m) return m[1];
  return /^f[A-Za-z0-9\-_]+$/.test(t) ? t : null;
}
