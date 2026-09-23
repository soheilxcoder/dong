import type { Activity, Expense, Group, Membership, Settlement, User } from '@dong/core';

/** Portable group snapshot embedded in invite links (serverless sharing). */
export interface Snapshot {
  v: 1;
  group: Group;
  members: (Membership & { user: User })[];
  expenses: Expense[];
  settlements: Settlement[];
  activity: Activity[];
}

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));

async function deflate(text: string) {
  const data = new TextEncoder().encode(text);
  if (typeof CompressionStream === 'undefined') return { z: false, bytes: data };
  const stream = new Blob([data as unknown as ArrayBuffer]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return { z: true, bytes: new Uint8Array(await new Response(stream).arrayBuffer()) };
}
async function inflate(bytes: Uint8Array, z: boolean) {
  if (!z) return new TextDecoder().decode(bytes);
  const stream = new Blob([bytes as unknown as ArrayBuffer]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
}

/** Strip heavy fields (images) so the link stays short. */
export async function encodeSnapshot(s: Snapshot): Promise<string> {
  const slim: Snapshot = {
    ...s,
    group: { ...s.group, coverImageUrl: null },
    members: s.members.map((m) => ({ ...m, user: { ...m.user, avatarUrl: null } })),
    expenses: s.expenses.map((e) => ({ ...e, receiptImageUrl: e.receiptImageUrl ? '__omitted__' : null })),
    settlements: s.settlements.map((x) => ({ ...x, receiptImageUrl: x.receiptImageUrl ? '__omitted__' : null })),
    activity: s.activity.slice(0, 60),
  };
  const { z, bytes } = await deflate(JSON.stringify(slim));
  return (z ? 'z' : 'p') + b64url(bytes);
}

export async function decodeSnapshot(code: string): Promise<Snapshot | null> {
  try {
    const z = code[0] === 'z';
    const text = await inflate(unb64url(code.slice(1)), z);
    const s = JSON.parse(text) as Snapshot;
    if (s.v !== 1 || !s.group?.id) return null;
    return s;
  } catch { return null; }
}
