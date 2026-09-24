import webpush from 'web-push';
import { all, run } from './db.js';

const enabled = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (enabled) webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com', process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);

export async function sendPush(userId: string, title: string, body: string) {
  if (!enabled) return;
  const subs = all<{ id: string; endpoint: string; keys: string }>('SELECT * FROM push_subscriptions WHERE userId = ?', userId);
  await Promise.all(subs.map(async (s) => {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: JSON.parse(s.keys) }, JSON.stringify({ title, body })); }
    catch (e) { if ((e as { statusCode?: number }).statusCode === 410) run('DELETE FROM push_subscriptions WHERE id = ?', s.id); }
  }));
}
