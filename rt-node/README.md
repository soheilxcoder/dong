# dong-rt (Node edition)

Zero-dependency WebSocket hub. Deploy on Plesk → subdomain `dong-rt.arounidea.com` → **Node.js**:
Application root = this folder (`rt-node`), Application startup file = `server.js`, Application mode = production. No `npm install` needed.
Health: `https://dong-rt.arounidea.com/health` → `{"ok":true,…}`. The app connects to `wss://dong-rt.arounidea.com/ws` (default baked in `apps/web/src/data/api.ts`, override with `VITE_RT_URL`).
Test: `RT_URL=ws://localhost:8787 node ../rt/test.mjs`.
