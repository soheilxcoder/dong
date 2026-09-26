import { disablePush } from '@/lib/push';
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
  }
  /** used by store.onSyncStatus wiring (same contract as LocalAdapter) */
  get syncStatus() { return this.status; }
  private setStatus(s: 'connecting' | 'online' | 'error') { if (s !== this.status) { this.status = s; this.statusCb?.(s); } }

  private emit() { this.listeners.forEach((l) => l()); }
  subscribe(cb: () => void) {
    this.listeners.add(cb);
    // Near-realtime: every 2.5 s ask the server for a tiny change signature (one small row set, no payload);
    // only when it differs do we refetch the actual data. Falls back to a full refresh every 30 s.
    let lastSig: string | null = null; let ticks = 0; let busy = false;
    const poll = async () => {
      if (document.visibilityState !== 'visible' || !this.token || busy) return;
      busy = true;
      try {
        const r = await this.req<{ sig: string }>('GET', '/sync');
        const changed = lastSig !== null && r.sig !== lastSig; lastSig = r.sig; if (changed || ++ticks % 12 === 0) cb();
      } catch { /* offline — status pill already updated by req() */ } finally { busy = false; }
    };
    const t = setInterval(() => { void poll(); }, 2500);
    const onVis = () => { if (document.visibilityState === 'visible') { lastSig = null; cb(); } };
    document.addEventListener('visibilitychange', onVis);
    return () => { this.listeners.delete(cb); clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
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
  async updateMe(patch: Partial<Pick<User, 'fullName' | 'avatarUrl' | 'cardNumber' | 'cardHolderName'>>) { const p = { ...patch }; if (p.avatarUrl) p.avatarUrl = await this.uploadIfDataUrl(p.avatarUrl); const u = await this.req<User>('PATCH', '/users/me', p); this.emit(); return u; }
  async changePassword(oldPassword: string, newPassword: string) { await this.req('POST', '/users/me/password', { oldPassword, newPassword }); }

  async myGroups() { return this.req<GroupDetail[]>('GET', '/groups'); }
  async createGroup(name: string, description?: string, coverImageUrl?: string | null) { const g = await this.req<Group>('POST', '/groups', { name, description, coverImageUrl: await this.uploadIfDataUrl(coverImageUrl) }); this.emit(); return g; }
  async updateGroup(id: string, patch: Partial<Pick<Group, 'name' | 'description' | 'coverImageUrl'>>) { const p = { ...patch }; if (p.coverImageUrl) p.coverImageUrl = await this.uploadIfDataUrl(p.coverImageUrl); const g = await this.req<Group>('PATCH', `/groups/${id}`, p); this.emit(); return g; }
  async getGroup(id: string) { return this.req<GroupDetail>('GET', `/groups/${id}`); }
  async groupByInvite(token: string) { try { return await this.req<{ group: Group; memberCount: number }>('GET', `/groups/invite/${token}`); } catch { return null; } }
  async joinGroup(token: string) { const g = await this.req<Group>('POST', `/groups/join/${token}`); this.emit(); return g; }
  async regenerateInvite(groupId: string) { const r = await this.req<{ inviteToken: string }>('POST', `/groups/${groupId}/invite/regenerate`); this.emit(); return r.inviteToken; }
  async removeMember(groupId: string, userId: string) { await this.req('DELETE', `/groups/${groupId}/members/${userId}`); this.emit(); }
  async leaveGroup(groupId: string) { const me = await this.me(); await this.req('DELETE', `/groups/${groupId}/members/${me!.id}`); this.emit(); }

  async addExpense(groupId: string, input: ExpenseInput) { const e = await this.req<Expense>('POST', `/groups/${groupId}/expenses`, { ...input, receiptImageUrl: await this.uploadIfDataUrl(input.receiptImageUrl) }); this.emit(); return e; }
  async updateExpense(id: string, input: ExpenseInput) { const e = await this.req<Expense>('PATCH', `/expenses/${id}`, { ...input, receiptImageUrl: await this.uploadIfDataUrl(input.receiptImageUrl) }); this.emit(); return e; }
  async deleteExpense(id: string) { await this.req('DELETE', `/expenses/${id}`); this.emit(); }

  async submitSettlement(groupId: string, toUser: string, amount: number, receiptImageUrl?: string | null, note?: string | null, fromUser?: string) { const s = await this.req<Settlement>('POST', '/settlements', { groupId, toUser, amount, receiptImageUrl: await this.uploadIfDataUrl(receiptImageUrl), note, fromUser }); this.emit(); return s; }
  async confirmSettlement(id: string) { await this.req('POST', `/settlements/${id}/confirm`); this.emit(); }
  async rejectSettlement(id: string, reason: string) { await this.req('POST', `/settlements/${id}/reject`, { reason }); this.emit(); }
  async cancelSettlement(id: string) { await this.req('DELETE', `/settlements/${id}`); this.emit(); }

  async activity(groupId: string) { return this.req<Activity[]>('GET', groupId ? `/groups/${groupId}/activity` : '/activity'); }
  async sendReminder(groupId: string, targetUserId: string, amount: number) { await this.req('POST', '/reminders', { groupId, targetUserId, amount }); this.emit(); }
  async reminders(groupId: string): Promise<Reminder[]> { return this.req<Reminder[]>('GET', `/groups/${groupId}/reminders`); }
}
