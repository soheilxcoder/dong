/**
 * Push notifications — two channels, both optional:
 *  • Android app (FCM v1): set FIREBASE_SERVICE_ACCOUNT to the path of (or the JSON of) a Firebase service-account key.
 *  • Browsers / PWA (Web Push): set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.
 * Subscriptions live in push_subscriptions; FCM tokens are stored with endpoint = "fcm:<token>".
 */
import fs from 'node:fs';
import webpush from 'web-push';
import { JWT } from 'google-auth-library';
import { all, run, uid, now } from './db.js';

const webEnabled = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (webEnabled) webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com', process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);

let fcm: { client: JWT; projectId: string } | null = null;
try {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (raw) {
    const json = JSON.parse(raw.startsWith('{') ? raw : fs.readFileSync(raw, 'utf8')) as { project_id: string; client_email: string; private_key: string };
    fcm = { projectId: json.project_id, client: new JWT({ email: json.client_email, key: json.private_key, scopes: ['https://www.googleapis.com/auth/firebase.messaging'] }) };
    console.log(`FCM push enabled (project ${json.project_id})`);
  }
} catch (e) { console.error('FIREBASE_SERVICE_ACCOUNT is invalid — FCM push disabled:', (e as Error).message); }

export const pushChannels = () => ({ fcm: !!fcm, web: webEnabled });

async function sendFcm(token: string, title: string, body: string, data: Record<string, string>) {
  if (!fcm) return;
  const { token: access } = await fcm.client.getAccessToken();
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${fcm.projectId}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data,
        android: { priority: 'high', notification: { channel_id: 'dong', icon: 'ic_stat_dong', color: '#0FB88A', sound: 'default', click_action: 'ir.dong.app.OPEN' } },
      },
    }),
  });
  if (res.status === 404 || res.status === 400) {
    const t = await res.text();
    if (/UNREGISTERED|INVALID_ARGUMENT|NOT_FOUND/.test(t)) run('DELETE FROM push_subscriptions WHERE endpoint = ?', `fcm:${token}`);
  }
}

/**
 * Deliver a notification to a user.
 * 1. ALWAYS stored in the `notifications` inbox — the Android app polls GET /users/me/notifications in the background
 *    (WorkManager, no Google services needed) and the web app polls it while open.
 * 2. Additionally pushed instantly via FCM / Web Push when those channels are configured.
 */
export async function sendPush(userId: string, title: string, body: string, groupId?: string) {
  run('INSERT INTO notifications (id, userId, title, body, groupId, createdAt) VALUES (?,?,?,?,?,?)', uid(), userId, title, body, groupId ?? null, now());
  run("DELETE FROM notifications WHERE userId = ? AND createdAt < datetime('now', '-30 days')", userId);
  if (!fcm && !webEnabled) return;
  const data = { groupId: groupId ?? '', url: groupId ? `#/g/${groupId}` : '#/' };
  const subs = all<{ id: string; endpoint: string; keys: string }>('SELECT * FROM push_subscriptions WHERE userId = ?', userId);
  await Promise.all(subs.map(async (s) => {
    try {
      if (s.endpoint.startsWith('fcm:')) await sendFcm(s.endpoint.slice(4), title, body, data);
      else if (webEnabled) await webpush.sendNotification({ endpoint: s.endpoint, keys: JSON.parse(s.keys) }, JSON.stringify({ title, body, ...data }));
    } catch (e) {
      if ((e as { statusCode?: number }).statusCode === 410 || (e as { statusCode?: number }).statusCode === 404) run('DELETE FROM push_subscriptions WHERE id = ?', s.id);
    }
  }));
}
