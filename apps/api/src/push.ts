import webpush from 'web-push';
import { prisma } from './lib.js';

const enabled = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (enabled) webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com', process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);

export async function sendPush(userId: string, title: string, body: string) {
  if (!enabled) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  await Promise.all(subs.map(async (s) => {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys as { p256dh: string; auth: string } }, JSON.stringify({ title, body })); }
    catch (e) { if ((e as { statusCode?: number }).statusCode === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }); }
  }));
}
