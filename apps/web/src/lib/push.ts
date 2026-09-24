/**
 * Push notifications for server mode.
 *  • Android app → FCM token via @capacitor/push-notifications
 *  • Browser / PWA → Web Push subscription (needs VAPID key from the server)
 * The token/subscription is sent to POST /users/me/push after login and removed on logout.
 */
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

export type PushApi = {
  base: string; // e.g. https://host/api
  token: () => string | null;
};

type Handlers = { onOpen: (url: string) => void; onForeground: (title: string, body: string) => void };

let currentDevice: { fcmToken?: string; endpoint?: string } = {};
let listenersAttached = false;
const PUSH_KEY = 'dong.push.registered';

const post = (api: PushApi, method: 'POST' | 'DELETE', body: unknown) =>
  fetch(`${api.base}/users/me/push`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${api.token()}` }, body: JSON.stringify(body) }).catch(() => undefined);

/** Ask permission (first time only), obtain a device token and register it on the server. Safe to call repeatedly. */
export async function enablePush(api: PushApi, h: Handlers): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!api.token()) return 'unsupported';
  if (Capacitor.isNativePlatform()) {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return 'denied';
    if (!listenersAttached) {
      listenersAttached = true;
      await PushNotifications.addListener('registration', ({ value }) => { currentDevice = { fcmToken: value }; localStorage.setItem(PUSH_KEY, value); void post(api, 'POST', { fcmToken: value }); });
      await PushNotifications.addListener('registrationError', () => { /* no Google services on this phone – silently ignore */ });
      // App is open: Android doesn't show the system notification for data+notification messages → show it in-app and refresh.
      await PushNotifications.addListener('pushNotificationReceived', (n) => h.onForeground(n.title ?? 'دُنگ', n.body ?? ''));
      await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
        const url = (notification.data as { url?: string } | undefined)?.url;
        if (url) h.onOpen(url.replace(/^#/, ''));
      });
      await PushNotifications.createChannel({ id: 'dong', name: 'دُنگ', description: 'هزینه‌ها، پرداخت‌ها و یادآوری‌ها', importance: 4, visibility: 1, vibration: true }).catch(() => {});
    }
    await PushNotifications.register();
    return 'granted';
  }
  // ---- Web Push (browser / installed PWA) ----
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  try {
    const cfg = await (await fetch(`${api.base}/push/config`)).json() as { vapidPublicKey: string | null };
    if (!cfg.vapidPublicKey) return 'unsupported';
    if (Notification.permission === 'default') await Notification.requestPermission();
    if (Notification.permission !== 'granted') return 'denied';
    // Dedicated tiny service worker (scope /push/) so it does not fight with the PWA cache worker.
    const reg = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}push/sw.js`, { scope: `${import.meta.env.BASE_URL}push/` });
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(cfg.vapidPublicKey) }));
    const j = sub.toJSON();
    currentDevice = { endpoint: sub.endpoint };
    await post(api, 'POST', { endpoint: sub.endpoint, keys: j.keys });
    navigator.serviceWorker.addEventListener('message', (e) => { if (e.data?.type === 'dong-open' && e.data.url) h.onOpen(String(e.data.url).replace(/^#/, '')); });
    return 'granted';
  } catch { return 'unsupported'; }
}

/** Unregister this device so the next person logging in on this phone does not receive our notifications. */
export async function disablePush(api: PushApi) {
  const fcmToken = currentDevice.fcmToken ?? localStorage.getItem(PUSH_KEY) ?? undefined;
  if (fcmToken || currentDevice.endpoint) await post(api, 'DELETE', fcmToken ? { fcmToken } : { endpoint: currentDevice.endpoint });
  localStorage.removeItem(PUSH_KEY);
  currentDevice = {};
}

function urlBase64ToUint8Array(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
