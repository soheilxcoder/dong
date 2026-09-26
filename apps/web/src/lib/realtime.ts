/**
 * Realtime channel to the Dong hub (rt — Cloudflare Worker + Durable Object).
 * Carries only "group <id> changed" signals; the PHP API stays the source of truth.
 *
 *  - auto-reconnect with capped backoff, re-subscribes after reconnect
 *  - heartbeat every 25 s (answered by the hub's auto-responder, so it keeps hibernating cheaply)
 *  - pauses while the tab is hidden (mobile OS would kill the socket anyway); reconnects on return
 *  - `onState` lets the adapter fall back to fast polling whenever the socket is not open
 */
export type RtState = 'off' | 'connecting' | 'open';

export class Realtime {
  private ws: WebSocket | null = null;
  private groups: string[] = [];
  private attempts = 0;
  private timer: number | null = null;
  private hb: number | null = null;
  private closed = false;
  state: RtState = 'off';
  constructor(private url: string, private onPing: (groupId: string, sig: string | null) => void, private onState: (s: RtState) => void = () => {}) {
    document.addEventListener('visibilitychange', this.onVis);
    window.addEventListener('online', this.connectSoon);
  }
  static resolve(raw: string | undefined): string | null {
    if (!raw) return null;
    let u = raw.trim().replace(/\/+$/, '');
    if (/^https?:/.test(u)) u = u.replace(/^http/, 'ws');
    if (!/^wss?:/.test(u)) u = 'wss://' + u;
    return u + '/ws';
  }
  private setState(s: RtState) { if (s !== this.state) { this.state = s; this.onState(s); } }
  private onVis = () => { if (document.visibilityState === 'visible') this.connectSoon(); else this.drop('hidden'); };
  private connectSoon = () => { if (this.closed) return; if (this.timer) return; this.timer = window.setTimeout(() => { this.timer = null; this.connect(); }, 50); };

  start() { this.closed = false; this.connect(); }
  stop() { this.closed = true; this.drop('stop'); document.removeEventListener('visibilitychange', this.onVis); window.removeEventListener('online', this.connectSoon); }

  /** replace the subscription list (group ids the current user belongs to) */
  subscribe(groups: string[]) {
    const next = [...new Set(groups)].sort();
    if (next.join() === this.groups.join()) return;
    this.groups = next;
    this.send({ t: 'sub', groups: this.groups });
  }
  /** tell everyone else in the group that it changed (call after a successful API write) */
  ping(groupId: string, sig: string | null = null) { this.send({ t: 'ping', g: groupId, sig }); }

  private send(o: unknown) { if (this.ws?.readyState === WebSocket.OPEN) { try { this.ws.send(JSON.stringify(o)); } catch { /* ignore */ } } }
  private drop(_why: string) {
    if (this.hb) { clearInterval(this.hb); this.hb = null; }
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const ws = this.ws; this.ws = null;
    if (ws) { ws.onclose = null; ws.onerror = null; ws.onmessage = null; try { ws.close(); } catch { /* ignore */ } }
    this.setState('off');
  }
  private connect() {
    if (this.closed || this.ws || document.visibilityState === 'hidden') return;
    this.setState('connecting');
    let ws: WebSocket;
    try { ws = new WebSocket(this.url); } catch { this.retry(); return; }
    this.ws = ws;
    const watchdog = window.setTimeout(() => { if (ws.readyState !== WebSocket.OPEN) { try { ws.close(); } catch { /* ignore */ } } }, 8000);
    ws.onopen = () => {
      clearTimeout(watchdog);
      this.attempts = 0;
      this.setState('open');
      if (this.groups.length) this.send({ t: 'sub', groups: this.groups });
      this.hb = window.setInterval(() => this.send({ t: 'hb' }), 25000);
    };
    ws.onmessage = (e) => {
      let m: { t?: string; g?: string; sig?: string | null };
      try { m = JSON.parse(String(e.data)); } catch { return; }
      if (m.t === 'ping' && typeof m.g === 'string') this.onPing(m.g, m.sig ?? null);
    };
    ws.onerror = () => { /* onclose follows */ };
    ws.onclose = () => { clearTimeout(watchdog); if (this.ws === ws) { this.ws = null; if (this.hb) { clearInterval(this.hb); this.hb = null; } this.setState('off'); this.retry(); } };
  }
  private retry() {
    if (this.closed || this.timer) return;
    const delay = Math.min(30000, 500 * 2 ** Math.min(this.attempts++, 6)) + Math.random() * 300;
    this.timer = window.setTimeout(() => { this.timer = null; this.connect(); }, delay);
  }
}
