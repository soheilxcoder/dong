/**
 * Notifications in server mode — three layers, no Google account required:
 *  1. In-app (any platform): while the app is open we poll GET /users/me/notifications and toast new items.
 *  2. Android background (default): native DongNotify plugin → WorkManager polls the same endpoint every ~15 min
 *     and shows system notifications. Pure Android, works without Google Play services.
 *  3. Optional instant push: FCM (if the APK was built with google-services.json) or Web Push (browser + VAPID).
 *     When FCM registers successfully the background poller is switched off to avoid duplicates.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

export type PushApi = { base: string; token: () => string | null };
type Handlers = { onOpen: (url: string) => void; onForeground: (title: string, body: string) => void };
type Notif = { id: string; title: string; body: string; groupId: string | null; createdAt: string };

const DongNotify = registerPlugin<{
  configure(o: { apiUrl: string; token: string }): Promise<{ ok: boolean }>;
  checkNow(): Promise<void>;
  disable(): Promise<void>;
}>('DongNotify');

const PUSH_KEY = 'dong.push.registered';
const SINCE_KEY = 'dong.notif.since';
let currentDevice: { fcmToken?: string; endpoint?: string } = {};
let listenersAttached = false;
let inAppTimer: number | undefined;

const post = (api: PushApi, method: 'POST' | 'DELETE', body: unknown) =>
  fetch(`${api.base}/users/me/push`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${api.token()}` }, body: JSON.stringify(body) }).catch(() => undefined);

/* ---------- layer 1: in-app polling ---------- */
function startInApp(api: PushApi, h: Handlers) {
  stopInApp();
  if (!localStorage.getItem(SINCE_KEY)) localStorage.setItem(SINCE_KEY, new Date().toISOString());
  const tick = async () => {
    if (document.visibilityState !== 'visible' || !api.token()) return;
    try {
      const since = localStorage.getItem(SINCE_KEY) ?? new Date().toISOString();
      const res = await fetch(`${api.base}/users/me/notifications?since=${encodeURIComponent(since)}`, { headers: { Authorization: `Bearer ${api.token()}` } });
      if (!res.ok) return;
      const items = (await res.json()) as Notif[];
      for (const n of items.slice(-3)) h.onForeground(n.title, n.body);
      if (items.length) localStorage.setItem(SINCE_KEY, items[items.length - 1].createdAt);
    } catch { /* offline */ }
  };
  inAppTimer = window.setInterval(tick, 10000);
  document.addEventListener('visibilitychange', tick);
  void tick();
}
function stopInApp() { if (inAppTimer) clearInterval(inAppTimer); inAppTimer = undefined; }

/** Enable notifications for the logged-in user. Safe to call repeatedly. */
export async function enablePush(api: PushApi, h: Handlers): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!api.token()) return 'unsupported';
  startInApp(api, h);

  if (Capacitor.isNativePlatform()) {
    // Android 13+ runtime permission (the plugin handles the dialog; older Androids are granted automatically)
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return 'denied';
    // layer 2: Google-free background poller — always on
    await DongNotify.configure({ apiUrl: api.base, token: api.token()! }).catch(() => {});
    // layer 3: FCM only if this build has Firebase; otherwise register() fails silently and the poller stays
    if (!listenersAttached) {
      listenersAttached = true;
      await PushNotifications.addListener('registration', ({ value }) => {
        currentDevice = { fcmToken: value }; localStorage.setItem(PUSH_KEY, value);
        void post(api, 'POST', { fcmToken: value });
        void DongNotify.disable().catch(() => {}); // instant channel available → no need to poll
      });
      await PushNotifications.addListener('registrationError', () => { /* no Firebase in this build / no Google services — poller handles it */ });
      await PushNotifications.addListener('pushNotificationReceived', (n) => h.onForeground(n.title ?? 'دُنگ', n.body ?? ''));
      await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
        const url = (notification.data as { url?: string } | undefined)?.url;
        if (url) h.onOpen(url.replace(/^#/, ''));
      });
    }
    PushNotifications.register().catch(() => {});
    return 'granted';
  }

  // ---- browser / PWA: Web Push if the server has VAPID keys ----
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'granted';
  try {
    const cfg = await (await fetch(`${api.base}/push/config`)).json() as { vapidPublicKey: string | null };
    if (!cfg.vapidPublicKey) return 'granted';
    if (Notification.permission === 'default') await Notification.requestPermission();
    if (Notification.permission !== 'granted') return 'denied';
    const reg = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}push/sw.js`, { scope: `${import.meta.env.BASE_URL}push/` });
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(cfg.vapidPublicKey) }));
    currentDevice = { endpoint: sub.endpoint };
    await post(api, 'POST', { endpoint: sub.endpoint, keys: sub.toJSON().keys });
    navigator.serviceWorker.addEventListener('message', (e) => { if (e.data?.type === 'dong-open' && e.data.url) h.onOpen(String(e.data.url).replace(/^#/, '')); });
    return 'granted';
  } catch { return 'granted'; }
}

/** Turn everything off for this device (logout / toggle off). */
export async function disablePush(api: PushApi) {
  stopInApp();
  localStorage.removeItem(SINCE_KEY);
  if (Capacitor.isNativePlatform()) await DongNotify.disable().catch(() => {});
  const fcmToken = currentDevice.fcmToken ?? localStorage.getItem(PUSH_KEY) ?? undefined;
  if (api.token() && (fcmToken || currentDevice.endpoint)) await post(api, 'DELETE', fcmToken ? { fcmToken } : { endpoint: currentDevice.endpoint });
  localStorage.removeItem(PUSH_KEY);
  currentDevice = {};
}

function urlBase64ToUint8Array(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
