/**
 * Dong realtime hub — plain Node.js edition (zero dependencies), for Plesk "Node.js" (Phusion Passenger) or any VPS.
 * Same wire protocol as rt/ (Cloudflare edition):
 *   client → hub : {"t":"sub","groups":["<groupId>",…]}   subscribe (replaces previous list)
 *   client → hub : {"t":"ping","g":"<groupId>","sig":"…"}  "this group changed"
 *   client → hub : {"t":"hb"}                               heartbeat → answered with {"t":"hb"}
 *   hub → client : {"t":"ping","g":"<groupId>","sig":"…"}  to every OTHER socket subscribed to g
 *   hub → client : {"t":"hello","n":<sockets>}              on connect
 * HTTP: GET /health, GET /stats, POST /notify {"g":"…","sig":"…"}
 * It never sees any expense data — only "group X changed" signals; the PHP API stays the source of truth.
 *
 * Run: PORT=8787 node server.js   (Passenger sets PORT itself; startup file = server.js)
 */
'use strict';
const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8787);
const MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const sockets = new Set(); // { sock, groups:Set, alive }

function json(res, o, s = 200) { res.writeHead(s, { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS }); res.end(JSON.stringify(o)); }

// ---- WebSocket framing (RFC 6455, server side: incoming frames are masked, outgoing unmasked) ----
function encode(data, opcode = 1) {
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(String(data));
  const len = payload.length;
  let head;
  if (len < 126) head = Buffer.from([0x80 | opcode, len]);
  else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | opcode; head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x80 | opcode; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([head, payload]);
}
function attach(sock) {
  const c = { sock, groups: new Set(), alive: true, buf: Buffer.alloc(0), frag: [] };
  sockets.add(c);
  const send = (o) => { if (!sock.destroyed) try { sock.write(encode(JSON.stringify(o))); } catch { /* ignore */ } };
  c.send = send;
  const close = (code = 1000) => { if (sock.destroyed) return; try { const b = Buffer.alloc(2); b.writeUInt16BE(code); sock.write(encode(b, 8)); } catch { /* ignore */ } sock.end(); };
  c.close = close;
  sock.on('data', (chunk) => {
    c.buf = Buffer.concat([c.buf, chunk]);
    if (c.buf.length > 1 << 20) return close(1009);
    for (;;) {
      const b = c.buf; if (b.length < 2) return;
      const fin = (b[0] & 0x80) !== 0, op = b[0] & 0x0f, masked = (b[1] & 0x80) !== 0;
      let len = b[1] & 0x7f, off = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
      if (!masked) return close(1002);
      if (b.length < off + 4 + len) return;
      const mask = b.subarray(off, off + 4); const data = Buffer.from(b.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      c.buf = b.subarray(off + 4 + len);
      if (op === 8) { close(1000); return; }
      if (op === 9) { try { sock.write(encode(data, 10)); } catch { /* ignore */ } continue; }
      if (op === 10) { c.alive = true; continue; }
      if (op === 1 || op === 2 || op === 0) {
        c.frag.push(data);
        if (!fin) continue;
        const msg = Buffer.concat(c.frag).toString('utf8'); c.frag = [];
        onMessage(c, msg);
      }
    }
  });
  const gone = () => { sockets.delete(c); };
  sock.on('close', gone); sock.on('error', gone); sock.on('end', gone);
  sock.setNoDelay(true); sock.setKeepAlive(true, 30000);
  send({ t: 'hello', n: sockets.size });
}
function broadcast(g, sig, from) {
  let n = 0; const msg = { t: 'ping', g, sig, at: Date.now() };
  for (const c of sockets) { if (c === from || !c.groups.has(g)) continue; c.send(msg); n++; }
  return n;
}
function onMessage(c, raw) {
  let m; try { m = JSON.parse(raw); } catch { return; }
  c.alive = true;
  if (m.t === 'hb') c.send({ t: 'hb' });
  else if (m.t === 'sub' && Array.isArray(m.groups)) {
    c.groups = new Set(m.groups.filter((x) => typeof x === 'string' && x.length <= 64).slice(0, 200));
    c.send({ t: 'subbed', n: c.groups.size });
  } else if (m.t === 'ping' && typeof m.g === 'string') {
    if (c.groups.has(m.g)) broadcast(m.g, typeof m.sig === 'string' ? m.sig : null, c);
  }
}
// drop dead sockets (no traffic for 2 heartbeat periods)
setInterval(() => { for (const c of sockets) { if (!c.alive) { c.close(1001); sockets.delete(c); continue; } c.alive = false; try { c.sock.write(encode(Buffer.alloc(0), 9)); } catch { /* ignore */ } } }, 60000).unref();

const server = http.createServer((req, res) => {
  const path = (req.url || '/').split('?')[0].replace(/\/+$/, '') || '/';
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  if (path === '/' || path === '/health') return json(res, { ok: true, name: 'dong-rt', edition: 'node', sockets: sockets.size });
  if (path === '/stats') return json(res, { sockets: sockets.size });
  if (path === '/ws') return json(res, { code: 'UPGRADE', message: 'expected websocket' }, 426);
  if (path === '/notify' && req.method === 'POST') {
    let body = ''; req.on('data', (d) => { body += d; if (body.length > 4096) req.destroy(); });
    req.on('end', () => { let b = {}; try { b = JSON.parse(body); } catch { /* ignore */ } if (typeof b.g !== 'string') return json(res, { code: 'BAD', message: 'g required' }, 400); json(res, { delivered: broadcast(b.g, b.sig ?? null, null) }); });
    return;
  }
  json(res, { code: 'NOT_FOUND' }, 404);
});
server.on('upgrade', (req, sock) => {
  const path = (req.url || '/').split('?')[0].replace(/\/+$/, '');
  const key = req.headers['sec-websocket-key'];
  if (path !== '/ws' || String(req.headers.upgrade || '').toLowerCase() !== 'websocket' || !key) { sock.write('HTTP/1.1 400 Bad Request\r\n\r\n'); return sock.destroy(); }
  const accept = crypto.createHash('sha1').update(key + MAGIC).digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  attach(sock);
});
server.listen(PORT, () => console.log('dong-rt (node) listening on', PORT));
