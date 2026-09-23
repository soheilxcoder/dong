/** Seeds the "سفر کیش" scenario from the spec (section 2). Run: npm run seed -w @dong/api */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const p = new PrismaClient();
const mk = async (fullName: string, username: string, cardNumber?: string) => p.user.upsert({ where: { username }, update: {}, create: { fullName, username, passwordHash: await bcrypt.hash('1234', 10), cardNumber } });
const [ali, reza, hossein, mohammad] = await Promise.all([mk('علی', 'ali', '6037991712345678'), mk('رضا', 'reza', '6104337812345678'), mk('حسین', 'hossein', '6219861012345678'), mk('محمد', 'mohammad')]);
const g = await p.group.create({ data: { name: 'سفر کیش', createdBy: ali.id, inviteToken: 'kish-demo', members: { create: [{ userId: ali.id, role: 'owner' }, { userId: reza.id, role: 'member' }, { userId: hossein.id, role: 'member' }, { userId: mohammad.id, role: 'member' }] } } });
const ex = (title: string, total: number, paidBy: string, shares: [string, number][], day: number) => p.expense.create({ data: { groupId: g.id, title, totalAmount: BigInt(total), paidBy, createdBy: paidBy, splitType: 'equal', paidAt: new Date(Date.now() - (4 - day) * 86400000), participants: { create: shares.map(([userId, a]) => ({ userId, amountOwed: BigInt(a) })) } } });
await ex('ناهار روز اول', 400000, ali.id, [[ali.id, 100000], [reza.id, 100000], [hossein.id, 100000], [mohammad.id, 100000]], 0);
await ex('تاکسی فرودگاه', 200000, reza.id, [[reza.id, 100000], [hossein.id, 100000]], 1);
await ex('شام روز دوم', 600000, hossein.id, [[ali.id, 200000], [hossein.id, 200000], [mohammad.id, 200000]], 2);
await ex('بلیط تفریحی', 300000, mohammad.id, [[ali.id, 75000], [reza.id, 75000], [hossein.id, 75000], [mohammad.id, 75000]], 3);
console.log('seeded: users ali/reza/hossein/mohammad (password 1234), invite token kish-demo');
await p.$disconnect();
