// Smoke test against a running hub: RT_URL=ws://localhost:8787 node test.mjs
// uses Node ≥22's built-in WebSocket
const base = (process.env.RT_URL || 'ws://localhost:8787').replace(/\/$/, '');
const open = (name) => new Promise((res, rej) => { const ws = new WebSocket(base + '/ws'); ws.addEventListener('message', (e) => { if (JSON.parse(e.data).t === 'hello') res(ws); }, { once: true }); ws.onerror = rej; ws.name = name; });
const next = (ws, pred = () => true) => new Promise((res) => { const h = (e) => { const m = JSON.parse(e.data); if (pred(m)) { ws.removeEventListener('message', h); res(m); } }; ws.addEventListener('message', h); });
const a = await open('a'), b = await open('b'), c = await open('c');
a.send(JSON.stringify({ t: 'sub', groups: ['g1', 'g2'] })); b.send(JSON.stringify({ t: 'sub', groups: ['g1'] })); c.send(JSON.stringify({ t: 'sub', groups: ['g9'] }));
await Promise.all([next(a, (m) => m.t === 'subbed'), next(b, (m) => m.t === 'subbed'), next(c, (m) => m.t === 'subbed')]);
let cGot = 0, aGot = 0; c.addEventListener('message', () => cGot++); a.addEventListener('message', () => aGot++);
const t0 = Date.now(); const pB = next(b, (m) => m.t === 'ping');
a.send(JSON.stringify({ t: 'ping', g: 'g1', sig: 'abc' }));
const m = await pB; const dt = Date.now() - t0;
await new Promise((r) => setTimeout(r, 300));
const ok = m.g === 'g1' && m.sig === 'abc' && cGot === 0 && aGot === 0;
console.log(ok ? `OK — b received ping for g1 in ${dt} ms; a (sender) and c (other group) received nothing` : `FAIL ${JSON.stringify({ m, cGot, aGot })}`);
a.close(); b.close(); c.close(); process.exit(ok ? 0 : 1);
