// Contract test for api/index.php run inside php-wasm (no PHP binary needed):
//   mkdir /tmp/phpt && cd /tmp/phpt && npm i @php-wasm/node && node /path/to/dong/tools/qa/api-php-test.mjs
import { loadNodeRuntime } from '@php-wasm/node';
import { PHP } from '@php-wasm/universal';
import fs from 'node:fs';
const php = new PHP(await loadNodeRuntime('8.3', { emscriptenOptions: { processId: 1 } }));
php.mkdir('/www'); php.mkdir('/www/api'); php.mkdir('/www/api/data');
php.writeFile('/www/api/index.php', fs.readFileSync('/home/user/dong/api/index.php', 'utf8'));
let n = 0, fails = 0;
async function call(method, path, body, token, expect) {
  const r = await php.run({ scriptPath: '/www/api/index.php', relativeUri: '/dong/api' + path, method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? new TextEncoder().encode(JSON.stringify(body)) : undefined,
    $_SERVER: { REQUEST_URI: '/dong/api' + path, SCRIPT_NAME: '/dong/api/index.php', DOCUMENT_ROOT: '/www', REQUEST_METHOD: method, ...(token ? { HTTP_AUTHORIZATION: 'Bearer ' + token } : {}) } });
  const txt = new TextDecoder().decode(r.bytes); let data; try { data = JSON.parse(txt); } catch { data = txt; }
  n++; const ok = expect === undefined || r.httpStatusCode === expect;
  if (!ok) { fails++; console.log('FAIL', method, path, r.httpStatusCode, 'expected', expect, txt.slice(0, 300), r.errors); }
  else console.log('ok', method, path, r.httpStatusCode, typeof data === 'string' ? data.slice(0, 120) : (data.code ? data.code + ': ' + data.message : ''));
  return data;
}
await call('GET', '/', null, null, 200);
const a = await call('POST', '/auth/register', { fullName: 'علی رضایی', username: 'ali', password: '1234', securityQuestion: 'q?', securityAnswer: 'x', cardNumber: '۶۰۳۷۹۹۱۱۲۲۳۳۴۴۵۵' }, null, 201);
await call('POST', '/auth/register', { fullName: 'علی', username: 'ali', password: '1234' }, null, 400);
const b = await call('POST', '/auth/register', { fullName: 'سارا', username: 'sara', password: '1234' }, null, 201);
await call('POST', '/auth/login', { username: 'ALI', password: 'wrong' }, null, 400);
const l = await call('POST', '/auth/login', { username: 'ali', password: '1234' }, null, 200);
const T = l.token, T2 = b.token;
await call('GET', '/users/me', null, null, 401);
const me = await call('GET', '/users/me', null, T, 200); console.log('  card', me.cardNumber);
await call('GET', '/auth/security-question/ali', null, null, 200);
await call('POST', '/auth/reset-password-with-security-answer', { username: 'ali', answer: 'x', newPassword: '9999' }, null, 200);
await call('POST', '/auth/login', { username: 'ali', password: '9999' }, null, 200);
await call('PATCH', '/users/me', { cardNumber: '6219861012345678', cardHolderName: 'Ali' }, T, 200);
await call('POST', '/users/me/password', { oldPassword: '9999', newPassword: '1234' }, T, 200);
const g = await call('POST', '/groups', { name: 'سفر شمال' }, T, 201);
const s0 = await call('GET', '/sync', null, T, 200);
const inv = await call('GET', '/groups/invite/' + g.inviteToken, null, null, 200);
await call('GET', '/groups/' + g.id, null, T2, 403);
await call('POST', '/groups/join/' + g.inviteToken, null, T2, 200);
const d = await call('GET', '/groups/' + g.id, null, T2, 200); console.log('  members', d.members.length, d.members[0].user.fullName);
const s1 = await call('GET', '/sync', null, T, 200); console.log('  sync changed:', s0.sig !== s1.sig);
await call('POST', `/groups/${g.id}/expenses`, { title: 'شام', totalAmount: 100001, paidBy: a.user.id, paidAt: new Date().toISOString(), splitType: 'equal', participants: [{ userId: a.user.id, amountOwed: 50001 }, { userId: b.user.id, amountOwed: 50000 }] }, T, 201);
await call('POST', `/groups/${g.id}/expenses`, { title: 'bad', totalAmount: 100, paidBy: a.user.id, paidAt: new Date().toISOString(), splitType: 'equal', participants: [{ userId: a.user.id, amountOwed: 10 }] }, T, 400);
const ex = await call('GET', `/groups/${g.id}/expenses`, null, T2, 200); console.log('  parts', JSON.stringify(ex[0].participants));
await call('PATCH', `/expenses/${ex[0].id}`, { title: 'شام ۲', totalAmount: 120000, paidBy: a.user.id, paidAt: new Date().toISOString(), splitType: 'equal', participants: [{ userId: a.user.id, amountOwed: 60000 }, { userId: b.user.id, amountOwed: 60000 }] }, T2, 403);
await call('PATCH', `/expenses/${ex[0].id}`, { title: 'شام ۲', totalAmount: 120000, paidBy: a.user.id, paidAt: new Date().toISOString(), splitType: 'equal', participants: [{ userId: a.user.id, amountOwed: 60000 }, { userId: b.user.id, amountOwed: 60000 }] }, T, 200);
await call('GET', `/groups/${g.id}/balances`, null, T, 200).then((r) => console.log('  bal', JSON.stringify(r.balances)));
await call('DELETE', `/groups/${g.id}/members/${b.user.id}`, null, T, 400);
const st = await call('POST', '/settlements', { groupId: g.id, toUser: a.user.id, amount: 60000, note: 'کارت' }, T2, 201);
await call('DELETE', `/groups/${g.id}/members/${b.user.id}`, null, T, 400);
await call('POST', `/settlements/${st.id}/confirm`, null, T2, 403);
await call('POST', `/settlements/${st.id}/reject`, { reason: 'نرسید' }, T, 200);
const st2 = await call('POST', '/settlements', { groupId: g.id, toUser: a.user.id, amount: 60000 }, T2, 201);
await call('POST', `/settlements/${st2.id}/confirm`, null, T, 200);
await call('GET', '/users/me/notifications', null, T2, 200).then((r) => console.log('  notif', r.length, r.map((x) => x.title).join(' | ')));
await call('POST', '/reminders', { groupId: g.id, targetUserId: b.user.id, amount: 1000 }, T, 200);
await call('POST', '/reminders', { groupId: g.id, targetUserId: b.user.id, amount: 1000 }, T, 400);
await call('GET', `/groups/${g.id}/reminders`, null, T, 200);
await call('GET', '/activity', null, T, 200).then((r) => console.log('  activity', r.length, r[0].description));
await call('GET', `/groups/${g.id}/activity`, null, T2, 200);
await call('POST', `/groups/${g.id}/invite/regenerate`, null, T2, 403);
await call('POST', `/groups/${g.id}/invite/regenerate`, null, T, 200);
await call('PATCH', `/groups/${g.id}`, { name: 'سفر شمال ۲' }, T, 200);
await call('DELETE', `/groups/${g.id}/members/${b.user.id}`, null, T2, 200);
await call('GET', '/groups', null, T2, 200).then((r) => console.log('  groups b', r.length));
await call('GET', '/groups', null, T, 200).then((r) => console.log('  groups a', r.length, r[0].expenses.length, r[0].settlements.length));
await call('DELETE', `/expenses/${ex[0].id}`, null, T, 200);
await call('GET', '/nope', null, null, 404);
await call('GET', '/uploads/zzz.png', null, null, 404);
console.log(`\n${n} calls, ${fails} failures`);
process.exit(fails ? 1 : 0);
