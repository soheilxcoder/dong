import { disablePush } from '@/lib/push';
import { Realtime } from '@/lib/realtime';
import type { Activity, Expense, Group, Reminder, Settlement, User } from '@dong/core';
import { AppError, type DataAdapter, type ExpenseInput, type GroupDetail, type RegisterInput } from './adapter';

/** Remote adapter for apps/api. Activated when the user sets a server URL in settings. */
export class ApiAdapter implements DataAdapter {
  readonly kind = 'api' as const;
  private listeners = new Set<() => void>();
  private token = localStorage.getItem('dong.token');
  private status: 'connecting' | 'online' | 'error' = 'connecting';
  private statusCb?: (s: 'connecting' | 'online' | 'error') => void;
  /** same contract as LocalAdapter.onSyncStatus — store wires the header pill through this */
  onSyncStatus(cb: (s: 'connecting' | 'online' | 'error') => void) { this.statusCb = cb; cb(this.status); }
  constructor(private base: string) {
    // accept "/api", "api", "https://host/api" — always resolve against the page origin
    this.base = new URL(base, location.href).toString().replace(/\/$/, '');
    const rtUrl = Realtime.resolve(import.meta.env.VITE_RT_URL as string | undefined);
    if (rtUrl) this.rt = new Realtime(rtUrl, (g) => { if (this.known.has(g)) this.listeners.forEach((l) => l()); }, (st) => { this.rtOpen = st === 'open'; this.statusCb?.(this.status); });
  }
  /** realtime hub (rt): instant "group changed" signals; null when the build has no VITE_RT_URL */
  private rt: Realtime | null = null;
  private rtOpen = false;
  /** groupId → updatedAt, as last seen from /sync (drives subscriptions + change pings) */
  private known = new Map<string, string>();
  get realtime() { return this.rtOpen; }
  /** fetch the tiny change map; subscribe the socket to my groups; ping groups whose updatedAt moved (after my own writes) */
  private async syncMap(pingChanged: boolean): Promise<string> {
    const r = await this.req<{ sig: string; groups: Record<string, string> }>('GET', '/sync');
    const next = new Map(Object.entries(r.groups));
    if (pingChanged && this.rt) for (const [g, at] of next) if (this.known.get(g) !== at) this.rt.ping(g, r.sig);
    this.known = next;
    this.rt?.subscribe([...next.keys()]);
    return r.sig;
  }
  /** after every successful write: local listeners now, everyone else via the hub (fire-and-forget) */
  private changed() { this.emit(); void this.syncMap(true).catch(() => {}); }
  /** used by store.onSyncStatus wiring (same contract as LocalAdapter) */
  get syncStatus() { return this.status; }
  private setStatus(s: 'connecting' | 'online' | 'error') { if (s !== this.status) { this.status = s; this.statusCb?.(s); } }

  private emit() { this.listeners.forEach((l) => l()); }
  subscribe(cb: () => void) {
    this.listeners.add(cb);
    // Near-realtime: every 2.5 s ask the server for a tiny change signature (one small row set, no payload);
    // only when it differs do we refetch the actual data. Falls back to a full refresh every 30 s.
    // With the realtime hub connected this is only a safety net (every ~20 s); without it, it IS the sync (every 2.5 s).
    let lastSig: string | null = null; let ticks = 0; let busy = false; let lastPoll = 0;
    const poll = async () => {
      if (document.visibilityState !== 'visible' || !this.token || busy) return;
      if (Date.now() - lastPoll < (this.rtOpen ? 20000 : 2400)) return;
      busy = true; lastPoll = Date.now();
      try {
        const sig = await this.syncMap(false);
        const changed = lastSig !== null && sig !== lastSig; lastSig = sig; if (changed || ++ticks % 12 === 0) cb();
      } catch { /* offline — status pill already updated by req() */ } finally { busy = false; }
    };
    this.rt?.start();
    const t = setInterval(() => { void poll(); }, 1000);
    const onVis = () => { if (document.visibilityState === 'visible') { lastSig = null; cb(); } };
    document.addEventListener('visibilitychange', onVis);
    return () => { this.listeners.delete(cb); clearInterval(t); document.removeEventListener('visibilitychange', onVis); this.rt?.stop(); };
  }

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(this.base + path, { method, headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch { this.setStatus('error'); throw new AppError('NETWORK', 'ارتباط با سرور برقرار نشد'); }
    this.setStatus('online');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new AppError(data.code ?? 'ERROR', data.message ?? 'خطای سرور');
    return data as T;
  }
  private setToken(t: string | null) { this.token = t; if (t) localStorage.setItem('dong.token', t); else localStorage.removeItem('dong.token'); }
  private async uploadIfDataUrl(url?: string | null) {
    if (!url || !url.startsWith('data:')) return url ?? null;
    const blob = await (await fetch(url)).blob();
    const fd = new FormData(); fd.append('file', blob, blob.type === 'image/webp' ? 'image.webp' : blob.type === 'image/png' ? 'image.png' : 'image.jpg');
    const res = await fetch(`${this.base}/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${this.token}` }, body: fd });
    if (!res.ok) throw new AppError('UPLOAD', 'آپلود تصویر ناموفق بود');
    const { url: stored } = (await res.json()) as { url: string };
    return new URL(stored, this.base + '/').toString();
  }

  async register(input: RegisterInput) { const r = await this.req<{ user: User; token: string }>('POST', '/auth/register', input); this.setToken(r.token); this.emit(); return r.user; }
  async login(username: string, password: string) { const r = await this.req<{ user: User; token: string }>('POST', '/auth/login', { username, password }); this.setToken(r.token); this.emit(); return r.user; }
  /** what lib/push needs to talk to the server */
  get pushApi() { return { base: this.base, token: () => this.token }; }
  async logout() { try { await disablePush(this.pushApi); } catch { /* ignore */ } this.setToken(null); this.emit(); }
  /** null = not logged in. Throws AppError('NETWORK') when the server is unreachable — the caller must NOT treat that as "logged out". */
  async me() {
    if (!this.token) return null;
    try { return await this.req<User>('GET', '/users/me'); }
    catch (e) { if (e instanceof AppError && e.code === 'NETWORK') throw e; this.setToken(null); return null; }
  }
  async getSecurityQuestion(username: string) { return (await this.req<{ question: string | null }>('GET', `/auth/security-question/${encodeURIComponent(username)}`)).question; }
  async resetPassword(username: string, answer: string, newPassword: string) { await this.req('POST', '/auth/reset-password-with-security-answer', { username, answer, newPassword }); }
  async updateMe(patch: Partial<Pick<User, 'fullName' | 'avatarUrl' | 'cardNumber' | 'cardHolderName'>>) { const p = { ...patch }; if (p.avatarUrl) p.avatarUrl = await this.uploadIfDataUrl(p.avatarUrl); const u = await this.req<User>('PATCH', '/users/me', p); this.changed(); return u; }
  async changePassword(oldPassword: string, newPassword: string) { await this.req('POST', '/users/me/password', { oldPassword, newPassword }); }

  async myGroups() { const gs = await this.req<GroupDetail[]>('GET', '/groups'); const next = new Map(gs.map((g) => [g.group.id, g.group.updatedAt ?? ''])); if (this.rt) { this.known = next; this.rt.subscribe([...next.keys()]); } return gs; }
  async createGroup(name: string, description?: string, coverImageUrl?: string | null) { const g = await this.req<Group>('POST', '/groups', { name, description, coverImageUrl: await this.uploadIfDataUrl(coverImageUrl) }); this.changed(); return g; }
  async updateGroup(id: string, patch: Partial<Pick<Group, 'name' | 'description' | 'coverImageUrl'>>) { const p = { ...patch }; if (p.coverImageUrl) p.coverImageUrl = await this.uploadIfDataUrl(p.coverImageUrl); const g = await this.req<Group>('PATCH', `/groups/${id}`, p); this.changed(); return g; }
  async getGroup(id: string) { return this.req<GroupDetail>('GET', `/groups/${id}`); }
  async groupByInvite(token: string) { try { return await this.req<{ group: Group; memberCount: number }>('GET', `/groups/invite/${token}`); } catch { return null; } }
  async joinGroup(token: string) { const g = await this.req<Group>('POST', `/groups/join/${token}`); this.changed(); return g; }
  async regenerateInvite(groupId: string) { const r = await this.req<{ inviteToken: string }>('POST', `/groups/${groupId}/invite/regenerate`); this.changed(); return r.inviteToken; }
  async removeMember(groupId: string, userId: string) { await this.req('DELETE', `/groups/${groupId}/members/${userId}`); this.changed(); }
  async leaveGroup(groupId: string) { const me = await this.me(); await this.req('DELETE', `/groups/${groupId}/members/${me!.id}`); this.changed(); }

  async addExpense(groupId: string, input: ExpenseInput) { const e = await this.req<Expense>('POST', `/groups/${groupId}/expenses`, { ...input, receiptImageUrl: await this.uploadIfDataUrl(input.receiptImageUrl) }); this.changed(); return e; }
  async updateExpense(id: string, input: ExpenseInput) { const e = await this.req<Expense>('PATCH', `/expenses/${id}`, { ...input, receiptImageUrl: await this.uploadIfDataUrl(input.receiptImageUrl) }); this.changed(); return e; }
  async deleteExpense(id: string) { await this.req('DELETE', `/expenses/${id}`); this.changed(); }

  async submitSettlement(groupId: string, toUser: string, amount: number, receiptImageUrl?: string | null, note?: string | null, fromUser?: string) { const s = await this.req<Settlement>('POST', '/settlements', { groupId, toUser, amount, receiptImageUrl: await this.uploadIfDataUrl(receiptImageUrl), note, fromUser }); this.changed(); return s; }
  async confirmSettlement(id: string) { await this.req('POST', `/settlements/${id}/confirm`); this.changed(); }
  async rejectSettlement(id: string, reason: string) { await this.req('POST', `/settlements/${id}/reject`, { reason }); this.changed(); }
  async cancelSettlement(id: string) { await this.req('DELETE', `/settlements/${id}`); this.changed(); }

  async activity(groupId: string) { return this.req<Activity[]>('GET', groupId ? `/groups/${groupId}/activity` : '/activity'); }
  async sendReminder(groupId: string, targetUserId: string, amount: number) { await this.req('POST', '/reminders', { groupId, targetUserId, amount }); this.changed(); }
  async reminders(groupId: string): Promise<Reminder[]> { return this.req<Reminder[]>('GET', `/groups/${groupId}/reminders`); }
}
