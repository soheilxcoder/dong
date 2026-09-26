/* Dong Web Push worker (scope /push/). Shows server notifications and opens the app on click. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('push', (e) => {
  let d = { title: 'دُنگ', body: '' };
  try { d = { ...d, ...e.data.json() }; } catch { d.body = e.data ? e.data.text() : ''; }
  e.waitUntil(self.registration.showNotification(d.title, { body: d.body, icon: '../icons/icon-192.png', badge: '../icons/icon-192.png', dir: 'rtl', lang: 'fa', data: { url: d.url || '#/' }, tag: d.url || 'dong' }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const hash = (e.notification.data && e.notification.data.url) || '#/';
  const appRoot = new URL('../', self.registration.scope).href; // /push/ → app base
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const c = list.find((w) => w.url.startsWith(appRoot));
    if (c) { c.postMessage({ type: 'dong-open', url: hash }); return c.focus(); }
    return self.clients.openWindow(appRoot + hash);
  })());
});
