/**
 * Serverless real-time sync over public Nostr relays.
 * - Each group has a random `syncKey` (in the invite link).
 * - From it we derive: a Nostr keypair (author identity) and an AES-GCM key (payload encryption).
 * - Every local change publishes a replaceable event (kind 30078) with the encrypted, compressed snapshot.
 * - Every device with the key subscribes and merges incoming snapshots (LWW by updatedAt, no deletes lost).
 * Relays see only ciphertext; nobody without the invite link can read anything.
 */
import { SimplePool, finalizeEvent, getPublicKey, type Event } from 'nostr-tools';
import { deflateSync, inflateSync, strToU8, strFromU8 } from 'fflate';
import type { Snapshot } from './snapshot';

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.primal.net',
  'wss://nostr.mom',
  'wss://relay.snort.social',
  'wss://relay.nostr.bg',
  'wss://nostr.wine',
];
/** Relays can be overridden (e.g. self-hosted) via localStorage 'dong.relays' = comma-separated list. */
export const RELAYS: string[] = (localStorage.getItem('dong.relays') ?? '').split(',').map((s) => s.trim()).filter(Boolean).length
  ? (localStorage.getItem('dong.relays') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  : DEFAULT_RELAYS;
const KIND = 30078; // NIP-78 application-specific data (parameterized replaceable)
const APP_TAG = 'dong.app/v1';

const enc = new TextEncoder();
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const b64 = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); };
const unb64 = (s: string) => { const bin = atob(s); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };

export const newSyncKey = () => hex(crypto.getRandomValues(new Uint8Array(16)));

async function derive(syncKey: string) {
  const sk = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode('dong-nostr-sk:' + syncKey)));
  const aesRaw = await crypto.subtle.digest('SHA-256', enc.encode('dong-aes:' + syncKey));
  const aes = await crypto.subtle.importKey('raw', aesRaw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  const idRaw = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode('dong-id:' + syncKey)));
  return { sk, pk: getPublicKey(sk), aes, d: hex(idRaw).slice(0, 32) };
}

async function seal(aes: CryptoKey, snap: Snapshot) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = deflateSync(strToU8(JSON.stringify(snap)), { level: 9 });
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, plain as unknown as ArrayBuffer));
  return b64(iv) + '.' + b64(ct);
}
async function open(aes: CryptoKey, content: string): Promise<Snapshot | null> {
  try {
    const [ivs, cts] = content.split('.');
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(ivs) }, aes, unb64(cts) as unknown as ArrayBuffer));
    return JSON.parse(strFromU8(inflateSync(plain))) as Snapshot;
  } catch { return null; }
}

export type SyncStatus = 'off' | 'connecting' | 'online' | 'error';

export class GroupSync {
  private pool = new SimplePool();
  private subs = new Map<string, { close: () => void; keys: Awaited<ReturnType<typeof derive>>; lastPublished?: string }>();
  private timers = new Map<string, number>();
  status: SyncStatus = 'off';
  onStatus?: (s: SyncStatus) => void;
  private setStatus(s: SyncStatus) { if (this.status !== s) { this.status = s; this.onStatus?.(s); } }

  constructor(private onIncoming: (groupId: string, snap: Snapshot) => Promise<void>) {}

  /** Start listening for a group; idempotent. */
  async watch(groupId: string, syncKey: string) {
    if (this.subs.has(groupId)) return;
    const keys = await derive(syncKey);
    this.setStatus('connecting');
    const entry: { close: () => void; keys: typeof keys; lastPublished?: string } = { close: () => {}, keys };
    this.subs.set(groupId, entry);
    const sub = this.pool.subscribeMany(RELAYS, { kinds: [KIND], authors: [keys.pk], '#d': [keys.d], limit: 1 }, {
      onevent: async (ev: Event) => {
        if (ev.content === entry.lastPublished) return;
        const snap = await open(keys.aes, ev.content);
        if (snap && snap.group?.id === groupId) await this.onIncoming(groupId, snap);
        this.setStatus('online');
      },
      oneose: () => this.setStatus('online'),
      onclose: () => { /* pool reconnects on next publish/subscribe */ },
    });
    entry.close = () => sub.close();
  }

  /** Force-reconnect every subscription (after app resume / network back) and pull the latest snapshot once. */
  async resync(getKey: (groupId: string) => Promise<string | undefined>) {
    const ids = [...this.subs.keys()];
    for (const id of ids) { this.subs.get(id)?.close(); this.subs.delete(id); }
    for (const id of ids) {
      const key = await getKey(id); if (!key) continue;
      this.watch(id, key).catch(() => {});
      this.fetchLatest(id, key, 5000).then((snap) => { if (snap) return this.onIncoming(id, snap); }).catch(() => {});
    }
  }

  unwatch(groupId: string) { this.subs.get(groupId)?.close(); this.subs.delete(groupId); if (!this.subs.size) this.setStatus('off'); }

  /** Debounced publish of the full (slim) snapshot. */
  publish(groupId: string, syncKey: string, getSnapshot: () => Promise<Snapshot>) {
    clearTimeout(this.timers.get(groupId));
    this.timers.set(groupId, window.setTimeout(async () => {
      try {
        await this.watch(groupId, syncKey);
        const entry = this.subs.get(groupId)!;
        const snap = await getSnapshot();
        const content = await seal(entry.keys.aes, snap);
        entry.lastPublished = content;
        const ev = finalizeEvent({ kind: KIND, created_at: Math.floor(Date.now() / 1000), tags: [['d', entry.keys.d], ['t', APP_TAG]], content }, entry.keys.sk);
        const results = await Promise.allSettled(this.pool.publish(RELAYS, ev));
        const ok = results.some((r) => r.status === 'fulfilled');
        this.setStatus(ok ? 'online' : 'error');
      } catch { this.setStatus('error'); }
    }, 250));
  }

  /** One-shot fetch of the latest snapshot for a key (used when joining). */
  async fetchLatest(groupId: string, syncKey: string, timeoutMs = 6000): Promise<Snapshot | null> {
    const keys = await derive(syncKey);
    const ev = await Promise.race([
      this.pool.get(RELAYS, { kinds: [KIND], authors: [keys.pk], '#d': [keys.d], limit: 1 }),
      new Promise<null>((r) => setTimeout(() => r(null), timeoutMs)),
    ]);
    if (!ev) return null;
    const snap = await open(keys.aes, ev.content);
    return snap && snap.group?.id === groupId ? snap : null;
  }
}
