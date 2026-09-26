/**
 * Dong realtime hub (Cloudflare Worker + one Durable Object, free plan).
 *
 * It never sees any expense data. Clients only exchange tiny signals:
 *   client → hub : {"t":"sub","groups":["<groupId>",…]}   subscribe (replaces previous list)
 *   client → hub : {"t":"ping","g":"<groupId>","sig":"…"}  "this group changed" (after a successful API write)
 *   hub → client : {"t":"ping","g":"<groupId>","sig":"…"}  delivered to every OTHER socket subscribed to g
 *   hub → client : {"t":"hello","n":<sockets>}              on connect
 * The app then refetches from the PHP API, which remains the single source of truth.
 * Group ids are unguessable UUIDs, so knowing the room name already requires being a member.
 *
 * Uses the WebSocket Hibernation API → idle sockets cost nothing.
 */
import { DurableObject } from 'cloudflare:workers';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', ...CORS } });

export class Hub extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"hb"}', '{"t":"hb"}'));
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return json({ code: 'UPGRADE', message: 'expected websocket' }, 426);
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ groups: [] });
      try { server.send(JSON.stringify({ t: 'hello', n: this.ctx.getWebSockets().length })); } catch {}
      return new Response(null, { status: 101, webSocket: client });
    }
    if (url.pathname === '/notify' && request.method === 'POST') {
      // optional server-side ping (e.g. from PHP): {"g":"<groupId>","sig":"…"}
      const b = await request.json().catch(() => ({}));
      if (typeof b.g !== 'string') return json({ code: 'BAD', message: 'g required' }, 400);
      return json({ delivered: this.broadcast(b.g, b.sig ?? null, null) });
    }
    if (url.pathname === '/stats') return json({ sockets: this.ctx.getWebSockets().length });
    return json({ code: 'NOT_FOUND' }, 404);
  }
  broadcast(g, sig, from) {
    let n = 0;
    const msg = JSON.stringify({ t: 'ping', g, sig, at: Date.now() });
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === from) continue;
      const att = ws.deserializeAttachment();
      if (!att?.groups?.includes(g)) continue;
      try { ws.send(msg); n++; } catch {}
    }
    return n;
  }
  webSocketMessage(ws, raw) {
    let m; try { m = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)); } catch { return; }
    if (m.t === 'sub' && Array.isArray(m.groups)) {
      const groups = m.groups.filter((x) => typeof x === 'string' && x.length <= 64).slice(0, 200);
      ws.serializeAttachment({ groups });
      try { ws.send(JSON.stringify({ t: 'subbed', n: groups.length })); } catch {}
    } else if (m.t === 'ping' && typeof m.g === 'string') {
      const att = ws.deserializeAttachment();
      if (att?.groups?.includes(m.g)) this.broadcast(m.g, typeof m.sig === 'string' ? m.sig : null, ws);
    }
  }
  webSocketClose(ws, code) { try { ws.close(code, 'bye'); } catch {} }
  webSocketError(ws) { try { ws.close(1011, 'error'); } catch {} }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    if (url.pathname === '/' || url.pathname === '/health') return json({ ok: true, name: 'dong-rt' });
    if (url.pathname === '/ws' || url.pathname === '/notify' || url.pathname === '/stats') {
      // one hub for everyone; plenty for the free tier (32k sockets per object)
      const id = env.HUB.idFromName('main');
      return env.HUB.get(id).fetch(request);
    }
    return json({ code: 'NOT_FOUND' }, 404);
  },
};
