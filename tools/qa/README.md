# QA

- `node tools/qa/setup-chromium.mjs` — unpack headless Chromium into `.cache/chromium`.
- Local PHP API for tests: php-wasm (`@php-wasm/node`) running `api/index.php` + static `apps/web/dist` (see e2e header). Build web with
  `VITE_BASE=/ VITE_PUBLIC_URL=http://localhost:8096/ VITE_API_URL=http://localhost:8096/api npm run build -w @dong/web`.
- `LD_LIBRARY_PATH=.cache/chromium/lib node tools/qa/e2e-two-users.mjs http://localhost:8096/` — two isolated browsers:
  register ×2, group, invite link, managed member, join, realtime member/expense/payment propagation, confirm, activity,
  profile rows, help, password eye, QR sheet, logout/login. 29 checks.
