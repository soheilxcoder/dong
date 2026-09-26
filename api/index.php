<?php
/**
 * دُنگ — Dong API (PHP edition, zero dependencies: PHP ≥ 7.4 + PDO SQLite).
 * Same contract as apps/api (Node). Deployed with the static site at <site>/dong/api/.
 * Data (SQLite + uploads) lives OUTSIDE the web root when possible: <docroot>/../dong-data
 */
declare(strict_types=1);
mb_internal_encoding('UTF-8');
date_default_timezone_set('UTC');
error_reporting(E_ALL);
ini_set('display_errors', '0');

/* ---------- CORS / JSON ---------- */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Max-Age: 86400');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

class HttpError extends Exception { public string $code2; public function __construct(int $status, string $code, string $msg) { parent::__construct($msg, $status); $this->code2 = $code; } }
function badReq(string $m, string $c = 'BAD_REQUEST'): HttpError { return new HttpError(400, $c, $m); }
function forbidden(string $m = 'دسترسی ندارید'): HttpError { return new HttpError(403, 'FORBIDDEN', $m); }
function notFound(string $m = 'پیدا نشد'): HttpError { return new HttpError(404, 'NOT_FOUND', $m); }
function sendJson($data, int $status = 200): void { http_response_code($status); header('Content-Type: application/json; charset=utf-8'); echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }

/* ---------- storage location ---------- */
$here = __DIR__;
$docroot = rtrim($_SERVER['DOCUMENT_ROOT'] ?? '', '/');
$candidates = [];
if ($docroot) $candidates[] = dirname($docroot) . '/dong-data';
$candidates[] = $here . '/data';
$DATA = null;
foreach ($candidates as $c) { if (!is_dir($c)) @mkdir($c, 0755, true); if (is_dir($c) && is_writable($c)) { $DATA = $c; break; } }
if (!$DATA) sendJson(['code' => 'STORAGE', 'message' => 'پوشهٔ داده قابل نوشتن نیست'], 500);
@mkdir("$DATA/uploads", 0755, true);
if (!file_exists("$DATA/.htaccess")) @file_put_contents("$DATA/.htaccess", "Require all denied\nDeny from all\n");

/* ---------- secret ---------- */
$secretFile = "$DATA/secret.key";
if (!file_exists($secretFile)) @file_put_contents($secretFile, bin2hex(random_bytes(32)));
$SECRET = trim((string)@file_get_contents($secretFile)) ?: 'dong-fallback-secret';

/* ---------- db ---------- */
try { $db = new PDO('sqlite:' . "$DATA/dong.db"); } catch (Throwable $e) { sendJson(['code' => 'DB', 'message' => 'SQLite در دسترس نیست: ' . $e->getMessage()], 500); }
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
$db->exec('PRAGMA journal_mode = WAL'); $db->exec('PRAGMA foreign_keys = ON'); $db->exec('PRAGMA busy_timeout = 5000');
$db->exec(<<<SQL
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, fullName TEXT NOT NULL, username TEXT NOT NULL UNIQUE, passwordHash TEXT NOT NULL, securityQuestion TEXT, securityAnswerHash TEXT, avatarUrl TEXT, cardNumber TEXT, cardHolderName TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, coverImageUrl TEXT, createdBy TEXT NOT NULL, inviteToken TEXT NOT NULL UNIQUE, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS memberships (id TEXT PRIMARY KEY, groupId TEXT NOT NULL, userId TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', joinedAt TEXT NOT NULL, updatedAt TEXT NOT NULL, UNIQUE(groupId, userId));
CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY, groupId TEXT NOT NULL, title TEXT NOT NULL, totalAmount INTEGER NOT NULL, paidBy TEXT NOT NULL, paidAt TEXT NOT NULL, splitType TEXT NOT NULL, receiptImageUrl TEXT, notes TEXT, status TEXT NOT NULL DEFAULT 'open', createdBy TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ix_expenses_group ON expenses(groupId);
CREATE TABLE IF NOT EXISTS expense_participants (expenseId TEXT NOT NULL, userId TEXT NOT NULL, amountOwed INTEGER NOT NULL, PRIMARY KEY(expenseId, userId));
CREATE TABLE IF NOT EXISTS settlements (id TEXT PRIMARY KEY, groupId TEXT NOT NULL, fromUser TEXT NOT NULL, toUser TEXT NOT NULL, amount INTEGER NOT NULL, receiptImageUrl TEXT, status TEXT NOT NULL DEFAULT 'pending_confirmation', note TEXT, rejectReason TEXT, submittedAt TEXT NOT NULL, confirmedAt TEXT, updatedAt TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ix_settlements_group ON settlements(groupId);
CREATE TABLE IF NOT EXISTS activity (id TEXT PRIMARY KEY, groupId TEXT NOT NULL, actorId TEXT NOT NULL, type TEXT NOT NULL, description TEXT NOT NULL, meta TEXT, createdAt TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ix_activity_group ON activity(groupId, createdAt);
CREATE TABLE IF NOT EXISTS reminders (id TEXT PRIMARY KEY, groupId TEXT NOT NULL, targetUserId TEXT NOT NULL, createdBy TEXT NOT NULL, frequency TEXT NOT NULL DEFAULT 'every_3_days', active INTEGER NOT NULL DEFAULT 1, lastSentAt TEXT, createdAt TEXT NOT NULL, UNIQUE(groupId, targetUserId));
CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, userId TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, groupId TEXT, createdAt TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ix_notifications_user ON notifications(userId, createdAt);
CREATE TABLE IF NOT EXISTS push_subscriptions (id TEXT PRIMARY KEY, userId TEXT NOT NULL, endpoint TEXT NOT NULL UNIQUE, keys TEXT NOT NULL, createdAt TEXT NOT NULL);
SQL);

/* ---------- helpers ---------- */
function newId(): string { $b = random_bytes(16); $b[6] = chr((ord($b[6]) & 0x0f) | 0x40); $b[8] = chr((ord($b[8]) & 0x3f) | 0x80); return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4)); }
function nowIso(): string { return gmdate('Y-m-d\TH:i:s') . sprintf('.%03dZ', (int)((microtime(true) - floor(microtime(true))) * 1000)); }
function newToken(): string { return rtrim(strtr(base64_encode(random_bytes(9)), '+/', '-_'), '='); }
function row(string $sql, array $p = []) { global $db; $s = $db->prepare($sql); $s->execute($p); $r = $s->fetch(); return $r === false ? null : $r; }
function rows(string $sql, array $p = []): array { global $db; $s = $db->prepare($sql); $s->execute($p); return $s->fetchAll(); }
function exec1(string $sql, array $p = []): void { global $db; $s = $db->prepare($sql); $s->execute($p); }
function tx(callable $fn) { global $db; $db->beginTransaction(); try { $r = $fn(); $db->commit(); return $r; } catch (Throwable $e) { $db->rollBack(); throw $e; } }
function b64u(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function b64ud(string $s): string { return base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4)); }
function signToken(string $uid): string { global $SECRET; $h = b64u(json_encode(['alg' => 'HS256', 'typ' => 'JWT'])); $p = b64u(json_encode(['sub' => $uid, 'iat' => time(), 'exp' => time() + 180 * 86400])); $sig = b64u(hash_hmac('sha256', "$h.$p", $SECRET, true)); return "$h.$p.$sig"; }
function verifyToken(string $t): ?string { global $SECRET; $parts = explode('.', $t); if (count($parts) !== 3) return null; [$h, $p, $s] = $parts; if (!hash_equals(b64u(hash_hmac('sha256', "$h.$p", $SECRET, true)), $s)) return null; $pl = json_decode(b64ud($p), true); if (!$pl || ($pl['exp'] ?? 0) < time()) return null; return (string)$pl['sub']; }
function toEnglishDigits(string $s): string { return strtr($s, ['۰'=>'0','۱'=>'1','۲'=>'2','۳'=>'3','۴'=>'4','۵'=>'5','۶'=>'6','۷'=>'7','۸'=>'8','۹'=>'9','٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9']); }
function normCard(string $c): string { return preg_replace('/\D/', '', toEnglishDigits($c)); }
function toman(int $n): string { $s = number_format($n); return toPersianDigits($s) . ' تومان'; }
function toPersianDigits(string $s): string { return strtr($s, ['0'=>'۰','1'=>'۱','2'=>'۲','3'=>'۳','4'=>'۴','5'=>'۵','6'=>'۶','7'=>'۷','8'=>'۸','9'=>'۹']); }
function safeUser(array $u): array { return ['id'=>$u['id'],'fullName'=>$u['fullName'],'username'=>$u['username'],'avatarUrl'=>$u['avatarUrl'],'cardNumber'=>$u['cardNumber'],'cardHolderName'=>$u['cardHolderName'],'createdAt'=>$u['createdAt'],'updatedAt'=>$u['updatedAt']]; }
function getUser(string $id): ?array { return row('SELECT * FROM users WHERE id = ?', [$id]); }
function getUserByName(string $n): ?array { return row('SELECT * FROM users WHERE username = ?', [strtolower(trim($n))]); }
function userName(string $id): string { $u = getUser($id); return $u ? $u['fullName'] : 'کاربر'; }
function getGroup(string $id): ?array { return row('SELECT * FROM groups WHERE id = ?', [$id]); }
function getGroupByToken(string $t): ?array { return row('SELECT * FROM groups WHERE inviteToken = ?', [$t]); }
function getMembership(string $g, string $u): ?array { return row('SELECT * FROM memberships WHERE groupId = ? AND userId = ?', [$g, $u]); }
function memberIds(string $g): array { return array_column(rows('SELECT userId FROM memberships WHERE groupId = ?', [$g]), 'userId'); }
function requireMember(string $g, string $u): array { $m = getMembership($g, $u); if (!$m) throw forbidden('شما عضو این گروه نیستید'); return $m; }
function touchGroup(string $g): void { exec1('UPDATE groups SET updatedAt = ? WHERE id = ?', [nowIso(), $g]); }
function expensesOf(string $g): array {
  $ex = rows('SELECT * FROM expenses WHERE groupId = ? ORDER BY paidAt DESC, createdAt DESC', [$g]);
  $ps = rows('SELECT p.* FROM expense_participants p JOIN expenses e ON e.id = p.expenseId WHERE e.groupId = ?', [$g]);
  foreach ($ex as &$e) { $e['totalAmount'] = (int)$e['totalAmount']; $e['participants'] = []; foreach ($ps as $p) if ($p['expenseId'] === $e['id']) $e['participants'][] = ['userId' => $p['userId'], 'amountOwed' => (int)$p['amountOwed']]; }
  return $ex;
}
function settlementsOf(string $g): array { $r = rows('SELECT * FROM settlements WHERE groupId = ? ORDER BY submittedAt DESC', [$g]); foreach ($r as &$s) $s['amount'] = (int)$s['amount']; return $r; }
function membersOf(string $g): array {
  $rows = rows('SELECT m.*, u.id AS u_id, u.fullName, u.username, u.avatarUrl, u.cardNumber, u.cardHolderName, u.createdAt AS u_createdAt, u.updatedAt AS u_updatedAt FROM memberships m JOIN users u ON u.id = m.userId WHERE m.groupId = ? ORDER BY m.joinedAt ASC', [$g]);
  return array_map(fn($r) => ['id'=>$r['id'],'groupId'=>$r['groupId'],'userId'=>$r['userId'],'role'=>$r['role'],'joinedAt'=>$r['joinedAt'],'updatedAt'=>$r['updatedAt'],
    'user'=>['id'=>$r['u_id'],'fullName'=>$r['fullName'],'username'=>$r['username'],'avatarUrl'=>$r['avatarUrl'],'cardNumber'=>$r['cardNumber'],'cardHolderName'=>$r['cardHolderName'],'createdAt'=>$r['u_createdAt'],'updatedAt'=>$r['u_updatedAt']]], $rows);
}
function groupDetail(string $g): ?array { $grp = getGroup($g); if (!$grp) return null; return ['group'=>$grp,'members'=>membersOf($g),'expenses'=>expensesOf($g),'settlements'=>settlementsOf($g)]; }
function logAct(string $g, string $actor, string $type, string $desc, ?array $meta = null): void { exec1('INSERT INTO activity (id, groupId, actorId, type, description, meta, createdAt) VALUES (?,?,?,?,?,?,?)', [newId(), $g, $actor, $type, $desc, $meta ? json_encode($meta, JSON_UNESCAPED_UNICODE) : null, nowIso()]); }
function pushNote(string $userId, string $title, string $body, ?string $groupId): void { exec1('INSERT INTO notifications (id, userId, title, body, groupId, createdAt) VALUES (?,?,?,?,?,?)', [newId(), $userId, $title, $body, $groupId, nowIso()]); }
function actRow(array $a): array { if (!empty($a['meta'])) $a['meta'] = json_decode($a['meta'], true); else unset($a['meta']); return $a; }
/** net balance per member: +paid −owed +sent(confirmed) −received(confirmed) */
function balancesOf(string $g): array {
  $bal = array_fill_keys(memberIds($g), 0);
  foreach (expensesOf($g) as $e) { $bal[$e['paidBy']] = ($bal[$e['paidBy']] ?? 0) + $e['totalAmount']; foreach ($e['participants'] as $p) $bal[$p['userId']] = ($bal[$p['userId']] ?? 0) - $p['amountOwed']; }
  $pending = [];
  foreach (settlementsOf($g) as $s) { if ($s['status'] === 'confirmed') { $bal[$s['fromUser']] = ($bal[$s['fromUser']] ?? 0) + $s['amount']; $bal[$s['toUser']] = ($bal[$s['toUser']] ?? 0) - $s['amount']; } elseif ($s['status'] === 'pending_confirmation') $pending[] = $s; }
  return [$bal, $pending];
}
function assertSettled(string $g, string $u): void { [$bal, $pending] = balancesOf($g); if (($bal[$u] ?? 0) !== 0) throw badReq('ابتدا حساب‌ها را تسویه کنید', 'UNSETTLED'); foreach ($pending as $s) if ($s['fromUser'] === $u || $s['toUser'] === $u) throw badReq('یک پرداخت در انتظار تأیید وجود دارد', 'PENDING'); }

/* ---------- request ---------- */
$method = $_SERVER['REQUEST_METHOD'];
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
$scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
$path = $uri; if ($scriptDir && strpos($path, $scriptDir) === 0) $path = substr($path, strlen($scriptDir));
$path = '/' . trim(preg_replace('#^/index\.php#', '', $path), '/');
$raw = file_get_contents('php://input');
$body = $raw ? (json_decode($raw, true) ?? []) : [];
$userId = null;
$authH = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
if (!$authH && function_exists('apache_request_headers')) { $hs = apache_request_headers(); $authH = $hs['Authorization'] ?? ($hs['authorization'] ?? ''); }
if (strpos($authH, 'Bearer ') === 0) $userId = verifyToken(substr($authH, 7));
function requireAuth(): string { global $userId; if (!$userId) throw new HttpError(401, 'UNAUTHENTICATED', 'ابتدا وارد شوید'); return $userId; }
function sval($v, string $name, int $min = 0, bool $req = true): ?string { if ($v === null || $v === '') { if ($req) throw badReq("$name: الزامی است", 'VALIDATION'); return null; } if (!is_string($v)) throw badReq("$name: نامعتبر", 'VALIDATION'); if (mb_strlen(trim($v)) < $min) throw badReq("$name: حداقل $min کاراکتر", 'VALIDATION'); return $v; }
function ival($v, string $name, bool $positive = true): int { if (!is_numeric($v) || (int)$v != $v) throw badReq("$name: عدد صحیح نیست", 'VALIDATION'); $n = (int)$v; if ($positive ? $n <= 0 : $n < 0) throw badReq("$name: مقدار نامعتبر", 'VALIDATION'); return $n; }
function route(string $m, string $pattern, callable $fn): void {
  global $method, $path;
  if ($method !== $m) return;
  $re = '#^' . preg_replace('#:([a-zA-Z]+)#', '(?P<$1>[^/]+)', $pattern) . '$#';
  if (!preg_match($re, $path, $mm)) return;
  $params = array_map('urldecode', array_filter($mm, 'is_string', ARRAY_FILTER_USE_KEY));
  $fn($params);
  exit;
}

try {
  route('GET', '/', fn() => sendJson(['ok' => true, 'name' => 'dong-api', 'engine' => 'php', 'php' => PHP_VERSION]));
  route('GET', '/health', fn() => sendJson(['ok' => true]));

  /* ---------- auth ---------- */
  route('POST', '/auth/register', function () use ($body) {
    $fullName = trim(sval($body['fullName'] ?? null, 'نام', 2)); $username = strtolower(trim(sval($body['username'] ?? null, 'نام کاربری')));
    if (!preg_match('/^[a-z0-9_]{3,20}$/', $username)) throw badReq('نام کاربری فقط حروف انگلیسی، عدد و _ (۳ تا ۲۰ کاراکتر)', 'BAD_USERNAME');
    $password = sval($body['password'] ?? null, 'رمز عبور', 4);
    if (getUserByName($username)) throw badReq('این نام کاربری قبلاً گرفته شده', 'USERNAME_TAKEN');
    $card = !empty($body['cardNumber']) ? normCard((string)$body['cardNumber']) : null;
    if ($card && !preg_match('/^\d{16}$/', $card)) throw badReq('شماره کارت باید ۱۶ رقم باشد');
    $id = newId(); $t = nowIso();
    exec1('INSERT INTO users (id, fullName, username, passwordHash, securityQuestion, securityAnswerHash, cardNumber, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?)',
      [$id, $fullName, $username, password_hash($password, PASSWORD_BCRYPT), !empty($body['securityQuestion']) ? trim((string)$body['securityQuestion']) : null, !empty($body['securityAnswer']) ? password_hash(trim((string)$body['securityAnswer']), PASSWORD_BCRYPT) : null, $card, $t, $t]);
    sendJson(['user' => safeUser(getUser($id)), 'token' => signToken($id)], 201);
  });
  route('POST', '/auth/login', function () use ($body) {
    $u = getUserByName((string)($body['username'] ?? ''));
    if (!$u || !password_verify((string)($body['password'] ?? ''), $u['passwordHash'])) throw badReq('نام کاربری یا رمز عبور اشتباه است', 'BAD_CREDENTIALS');
    sendJson(['user' => safeUser($u), 'token' => signToken($u['id'])]);
  });
  route('GET', '/auth/security-question/:username', function ($p) { $u = getUserByName($p['username']); sendJson(['question' => $u['securityQuestion'] ?? null]); });
  route('POST', '/auth/reset-password-with-security-answer', function () use ($body) {
    $u = getUserByName((string)($body['username'] ?? '')); $np = sval($body['newPassword'] ?? null, 'رمز جدید', 4);
    if (!$u || empty($u['securityAnswerHash']) || !password_verify(trim((string)($body['answer'] ?? '')), $u['securityAnswerHash'])) throw badReq('پاسخ سؤال امنیتی اشتباه است', 'BAD_ANSWER');
    exec1('UPDATE users SET passwordHash = ?, updatedAt = ? WHERE id = ?', [password_hash($np, PASSWORD_BCRYPT), nowIso(), $u['id']]);
    sendJson(['ok' => true]);
  });

  /* ---------- users ---------- */
  route('GET', '/users/me', function () { $u = getUser(requireAuth()); if (!$u) throw notFound('کاربر پیدا نشد'); sendJson(safeUser($u)); });
  route('PATCH', '/users/me', function () use ($body) {
    $u = getUser(requireAuth());
    $card = $u['cardNumber'];
    if (array_key_exists('cardNumber', $body)) { $card = $body['cardNumber'] ? normCard((string)$body['cardNumber']) : null; if ($card && !preg_match('/^\d{16}$/', $card)) throw badReq('شماره کارت باید ۱۶ رقم باشد'); }
    $fullName = isset($body['fullName']) ? trim(sval($body['fullName'], 'نام', 2)) : $u['fullName'];
    $avatar = array_key_exists('avatarUrl', $body) ? $body['avatarUrl'] : $u['avatarUrl'];
    $holder = array_key_exists('cardHolderName', $body) ? $body['cardHolderName'] : $u['cardHolderName'];
    exec1('UPDATE users SET fullName = ?, avatarUrl = ?, cardNumber = ?, cardHolderName = ?, updatedAt = ? WHERE id = ?', [$fullName, $avatar, $card, $holder, nowIso(), $u['id']]);
    foreach (rows('SELECT groupId FROM memberships WHERE userId = ?', [$u['id']]) as $m) touchGroup($m['groupId']);
    sendJson(safeUser(getUser($u['id'])));
  });
  route('POST', '/users/me/password', function () use ($body) {
    $u = getUser(requireAuth()); $np = sval($body['newPassword'] ?? null, 'رمز جدید', 4);
    if (!password_verify((string)($body['oldPassword'] ?? ''), $u['passwordHash'])) throw badReq('رمز فعلی اشتباه است', 'BAD_CREDENTIALS');
    exec1('UPDATE users SET passwordHash = ?, updatedAt = ? WHERE id = ?', [password_hash($np, PASSWORD_BCRYPT), nowIso(), $u['id']]);
    sendJson(['ok' => true]);
  });
  route('POST', '/users/me/push', function () use ($body) {
    $me = requireAuth(); $endpoint = !empty($body['fcmToken']) ? 'fcm:' . $body['fcmToken'] : ($body['endpoint'] ?? null);
    if (!$endpoint) throw badReq('endpoint لازم است');
    exec1('INSERT INTO push_subscriptions (id, userId, endpoint, keys, createdAt) VALUES (?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET userId = excluded.userId, keys = excluded.keys', [newId(), $me, $endpoint, json_encode($body['keys'] ?? new stdClass()), nowIso()]);
    sendJson(['ok' => true, 'channels' => []]);
  });
  route('DELETE', '/users/me/push', function () use ($body) { $me = requireAuth(); $endpoint = !empty($body['fcmToken']) ? 'fcm:' . $body['fcmToken'] : ($body['endpoint'] ?? null); if ($endpoint) exec1('DELETE FROM push_subscriptions WHERE endpoint = ? AND userId = ?', [$endpoint, $me]); sendJson(['ok' => true]); });
  route('GET', '/users/me/notifications', function () { $me = requireAuth(); $since = $_GET['since'] ?? gmdate('Y-m-d\TH:i:s\Z', time() - 7 * 86400); sendJson(rows('SELECT id, title, body, groupId, createdAt FROM notifications WHERE userId = ? AND createdAt > ? ORDER BY createdAt ASC LIMIT 50', [$me, $since])); });
  route('GET', '/push/config', fn() => sendJson(['channels' => [], 'vapidPublicKey' => null]));

  /* ---------- realtime-ish: cheap change detector for polling clients ---------- */
  route('GET', '/sync', function () {
    $me = requireAuth();
    $groups = rows('SELECT g.id, g.updatedAt FROM groups g JOIN memberships m ON m.groupId = g.id WHERE m.userId = ?', [$me]);
    $n = row('SELECT MAX(createdAt) AS t FROM notifications WHERE userId = ?', [$me]);
    $sig = md5(json_encode($groups) . ($n['t'] ?? ''));
    sendJson(['sig' => $sig, 'groups' => array_column($groups, 'updatedAt', 'id'), 'now' => nowIso()]);
  });

  /* ---------- groups ---------- */
  route('GET', '/groups', function () { $me = requireAuth(); $ids = array_column(rows('SELECT groupId FROM memberships WHERE userId = ? ORDER BY joinedAt DESC', [$me]), 'groupId'); sendJson(array_values(array_filter(array_map('groupDetail', $ids)))); });
  route('POST', '/groups', function () use ($body) {
    $me = requireAuth(); $name = trim(sval($body['name'] ?? null, 'نام گروه', 2)); $id = newId(); $t = nowIso();
    tx(function () use ($id, $name, $body, $me, $t) {
      exec1('INSERT INTO groups (id, name, description, coverImageUrl, createdBy, inviteToken, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?)', [$id, $name, $body['description'] ?? null, $body['coverImageUrl'] ?? null, $me, newToken(), $t, $t]);
      exec1('INSERT INTO memberships (id, groupId, userId, role, joinedAt, updatedAt) VALUES (?,?,?,?,?,?)', [newId(), $id, $me, 'owner', $t, $t]);
      logAct($id, $me, 'group_created', userName($me) . " گروه «{$name}» را ساخت");
    });
    sendJson(getGroup($id), 201);
  });
  route('GET', '/groups/invite/:token', function ($p) { $g = getGroupByToken($p['token']); if (!$g) throw notFound('لینک دعوت نامعتبر است'); sendJson(['group' => $g, 'memberCount' => count(memberIds($g['id']))]); });
  route('POST', '/groups/join/:token', function ($p) {
    $me = requireAuth(); $g = getGroupByToken($p['token']); if (!$g) throw notFound('لینک دعوت نامعتبر است'); $gid = $g['id'];
    if (!getMembership($gid, $me)) {
      $t = nowIso();
      tx(function () use ($gid, $me, $t, $g) {
        exec1('INSERT INTO memberships (id, groupId, userId, role, joinedAt, updatedAt) VALUES (?,?,?,?,?,?)', [newId(), $gid, $me, 'member', $t, $t]);
        logAct($gid, $me, 'member_joined', userName($me) . ' به گروه پیوست'); touchGroup($gid);
        foreach (memberIds($gid) as $m) if ($m !== $me) pushNote($m, 'عضو جدید در دُنگ', userName($me) . " به «{$g['name']}» پیوست", $gid);
      });
    }
    sendJson(getGroup($gid));
  });
  route('GET', '/groups/:id', function ($p) { requireMember($p['id'], requireAuth()); $d = groupDetail($p['id']); if (!$d) throw notFound('گروه پیدا نشد'); sendJson($d); });
  route('PATCH', '/groups/:id', function ($p) use ($body) {
    $me = requireAuth(); if (requireMember($p['id'], $me)['role'] !== 'owner') throw forbidden('فقط مالک گروه می‌تواند ویرایش کند');
    $g = getGroup($p['id']);
    exec1('UPDATE groups SET name = ?, description = ?, coverImageUrl = ?, updatedAt = ? WHERE id = ?', [isset($body['name']) ? trim(sval($body['name'], 'نام گروه', 2)) : $g['name'], array_key_exists('description', $body) ? $body['description'] : $g['description'], array_key_exists('coverImageUrl', $body) ? $body['coverImageUrl'] : $g['coverImageUrl'], nowIso(), $g['id']]);
    sendJson(getGroup($g['id']));
  });
  route('POST', '/groups/:id/invite/regenerate', function ($p) { $me = requireAuth(); if (requireMember($p['id'], $me)['role'] !== 'owner') throw forbidden(); $t = newToken(); exec1('UPDATE groups SET inviteToken = ?, updatedAt = ? WHERE id = ?', [$t, nowIso(), $p['id']]); sendJson(['inviteToken' => $t]); });
  route('GET', '/groups/:id/balances', function ($p) { requireMember($p['id'], requireAuth()); [$bal, $pending] = balancesOf($p['id']); $out = []; foreach ($bal as $u => $b) $out[] = ['userId' => $u, 'balance' => $b]; sendJson(['balances' => $out, 'pending' => $pending]); });
  route('GET', '/groups/:id/activity', function ($p) { requireMember($p['id'], requireAuth()); sendJson(array_map('actRow', rows('SELECT * FROM activity WHERE groupId = ? ORDER BY createdAt DESC LIMIT 300', [$p['id']]))); });
  route('GET', '/activity', function () { $me = requireAuth(); sendJson(array_map('actRow', rows('SELECT a.* FROM activity a JOIN memberships m ON m.groupId = a.groupId AND m.userId = ? ORDER BY a.createdAt DESC LIMIT 300', [$me]))); });
  route('GET', '/groups/:id/expenses', function ($p) { requireMember($p['id'], requireAuth()); sendJson(expensesOf($p['id'])); });
  route('GET', '/groups/:id/settlements', function ($p) { requireMember($p['id'], requireAuth()); sendJson(settlementsOf($p['id'])); });
  route('GET', '/groups/:id/reminders', function ($p) { requireMember($p['id'], requireAuth()); sendJson(array_map(fn($r) => $r + ['active' => (bool)$r['active']], rows('SELECT * FROM reminders WHERE groupId = ?', [$p['id']]))); });
  route('DELETE', '/groups/:id/members/:userId', function ($p) {
    $me = requireAuth(); $m = requireMember($p['id'], $me); $self = $p['userId'] === $me;
    if (!$self && $m['role'] !== 'owner') throw forbidden('فقط مالک گروه می‌تواند عضو حذف کند');
    if (!getMembership($p['id'], $p['userId'])) throw notFound('عضو پیدا نشد');
    assertSettled($p['id'], $p['userId']);
    tx(function () use ($p, $me, $self) { exec1('DELETE FROM memberships WHERE groupId = ? AND userId = ?', [$p['id'], $p['userId']]); logAct($p['id'], $me, $self ? 'member_left' : 'member_removed', $self ? userName($me) . ' از گروه خارج شد' : userName($me) . ' ' . userName($p['userId']) . ' را از گروه حذف کرد'); touchGroup($p['id']); });
    sendJson(['ok' => true]);
  });

  /* ---------- expenses ---------- */
  $parseExpense = function (string $gid) use ($body): array {
    $title = trim(sval($body['title'] ?? null, 'عنوان', 1)); $total = ival($body['totalAmount'] ?? null, 'مبلغ');
    $paidBy = sval($body['paidBy'] ?? null, 'پرداخت‌کننده'); $paidAt = sval($body['paidAt'] ?? null, 'تاریخ');
    $split = $body['splitType'] ?? ''; if (!in_array($split, ['equal', 'custom', 'by_payer'], true)) throw badReq('روش تقسیم نامعتبر', 'VALIDATION');
    $parts = $body['participants'] ?? []; if (!is_array($parts) || !count($parts)) throw badReq('حداقل یک شرکت‌کننده لازم است', 'VALIDATION');
    $ps = []; $sum = 0; foreach ($parts as $x) { $a = ival($x['amountOwed'] ?? null, 'سهم', false); $ps[] = ['userId' => (string)$x['userId'], 'amountOwed' => $a]; $sum += $a; }
    if ($sum !== $total) throw badReq('مجموع سهم‌ها (' . toman($sum) . ') با مبلغ کل برابر نیست', 'SUM_MISMATCH');
    $ids = memberIds($gid); if (!in_array($paidBy, $ids, true)) throw badReq('همه شرکت‌کننده‌ها باید عضو گروه باشند'); foreach ($ps as $x) if (!in_array($x['userId'], $ids, true)) throw badReq('همه شرکت‌کننده‌ها باید عضو گروه باشند');
    $ts = strtotime($paidAt); if ($ts === false) throw badReq('تاریخ نامعتبر است');
    return ['title' => $title, 'totalAmount' => $total, 'paidBy' => $paidBy, 'paidAt' => gmdate('Y-m-d\TH:i:s.000\Z', $ts), 'splitType' => $split, 'participants' => $ps, 'receiptImageUrl' => $body['receiptImageUrl'] ?? null, 'notes' => $body['notes'] ?? null];
  };
  $expenseById = function (string $id): ?array { $g = row('SELECT groupId FROM expenses WHERE id = ?', [$id]); if (!$g) return null; foreach (expensesOf($g['groupId']) as $e) if ($e['id'] === $id) return $e; return null; };
  $writeParts = function (string $eid, array $ps) { exec1('DELETE FROM expense_participants WHERE expenseId = ?', [$eid]); foreach ($ps as $p) exec1('INSERT INTO expense_participants (expenseId, userId, amountOwed) VALUES (?,?,?)', [$eid, $p['userId'], $p['amountOwed']]); };
  route('POST', '/groups/:id/expenses', function ($p) use ($parseExpense, $expenseById, $writeParts) {
    $me = requireAuth(); requireMember($p['id'], $me); $b = $parseExpense($p['id']); $id = newId(); $t = nowIso();
    tx(function () use ($p, $b, $id, $t, $me, $writeParts) {
      exec1('INSERT INTO expenses (id, groupId, title, totalAmount, paidBy, paidAt, splitType, receiptImageUrl, notes, status, createdBy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [$id, $p['id'], $b['title'], $b['totalAmount'], $b['paidBy'], $b['paidAt'], $b['splitType'], $b['receiptImageUrl'], $b['notes'], 'open', $me, $t, $t]);
      $writeParts($id, $b['participants']);
      logAct($p['id'], $me, 'expense_created', userName($me) . " هزینه «{$b['title']}» به مبلغ " . toman($b['totalAmount']) . ' ثبت کرد', ['expenseId' => $id]); touchGroup($p['id']);
      foreach ($b['participants'] as $x) if ($x['userId'] !== $me) pushNote($x['userId'], 'هزینه جدید در دُنگ', userName($me) . ": «{$b['title']}» — سهم شما " . toman($x['amountOwed']), $p['id']);
    });
    sendJson($expenseById($id), 201);
  });
  route('PATCH', '/expenses/:id', function ($p) use ($parseExpense, $expenseById, $writeParts) {
    $me = requireAuth(); $old = $expenseById($p['id']); if (!$old) throw notFound(); $m = requireMember($old['groupId'], $me);
    if ($old['createdBy'] !== $me && $m['role'] !== 'owner') throw forbidden('فقط ثبت‌کننده یا مالک گروه می‌تواند ویرایش کند');
    $b = $parseExpense($old['groupId']);
    tx(function () use ($old, $b, $me, $writeParts) {
      exec1('UPDATE expenses SET title = ?, totalAmount = ?, paidBy = ?, paidAt = ?, splitType = ?, receiptImageUrl = ?, notes = ?, updatedAt = ? WHERE id = ?', [$b['title'], $b['totalAmount'], $b['paidBy'], $b['paidAt'], $b['splitType'], $b['receiptImageUrl'], $b['notes'], nowIso(), $old['id']]);
      $writeParts($old['id'], $b['participants']);
      logAct($old['groupId'], $me, 'expense_updated', (int)$old['totalAmount'] !== $b['totalAmount'] ? userName($me) . " مبلغ «{$b['title']}» را از " . toman((int)$old['totalAmount']) . ' به ' . toman($b['totalAmount']) . ' ویرایش کرد' : userName($me) . " هزینه «{$b['title']}» را ویرایش کرد", ['expenseId' => $old['id']]); touchGroup($old['groupId']);
    });
    sendJson($expenseById($old['id']));
  });
  route('DELETE', '/expenses/:id', function ($p) use ($expenseById) {
    $me = requireAuth(); $e = $expenseById($p['id']); if (!$e) throw notFound(); $m = requireMember($e['groupId'], $me);
    if ($e['createdBy'] !== $me && $m['role'] !== 'owner') throw forbidden('فقط ثبت‌کننده یا مالک گروه می‌تواند حذف کند');
    foreach (settlementsOf($e['groupId']) as $s) if ($s['status'] === 'pending_confirmation') throw badReq('پرداخت در انتظار تأیید وجود دارد؛ ابتدا آن‌ها را تعیین تکلیف کنید', 'HAS_SETTLEMENTS');
    tx(function () use ($e, $me) { exec1('DELETE FROM expense_participants WHERE expenseId = ?', [$e['id']]); exec1('DELETE FROM expenses WHERE id = ?', [$e['id']]); logAct($e['groupId'], $me, 'expense_deleted', userName($me) . " هزینه «{$e['title']}» (" . toman((int)$e['totalAmount']) . ') را حذف کرد'); touchGroup($e['groupId']); });
    sendJson(['ok' => true]);
  });

  /* ---------- settlements ---------- */
  $settlement = fn(string $id) => row('SELECT * FROM settlements WHERE id = ?', [$id]);
  route('POST', '/settlements', function () use ($body, $settlement) {
    $me = requireAuth(); $gid = sval($body['groupId'] ?? null, 'گروه'); $to = sval($body['toUser'] ?? null, 'گیرنده'); $amount = ival($body['amount'] ?? null, 'مبلغ');
    requireMember($gid, $me); requireMember($gid, $to);
    $from = (!empty($body['fromUser']) && $body['fromUser'] !== $me) ? (string)$body['fromUser'] : $me; if ($from !== $me) requireMember($gid, $from);
    if ($to === $from) throw badReq('نمی‌توانید به خودتان پرداخت کنید');
    $id = newId(); $t = nowIso(); $auto = $to === $me;
    tx(function () use ($id, $gid, $from, $to, $amount, $body, $auto, $t, $me) {
      exec1('INSERT INTO settlements (id, groupId, fromUser, toUser, amount, receiptImageUrl, status, note, submittedAt, confirmedAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [$id, $gid, $from, $to, $amount, $body['receiptImageUrl'] ?? null, $auto ? 'confirmed' : 'pending_confirmation', $body['note'] ?? null, $t, $auto ? $t : null, $t]);
      logAct($gid, $me, $auto ? 'settlement_confirmed' : 'settlement_submitted', $auto ? userName($me) . ' دریافت ' . toman($amount) . ' از ' . userName($from) . ' را ثبت کرد' : userName($from) . ' پرداخت ' . toman($amount) . ' به ' . userName($to) . ' را ثبت کرد (در انتظار تأیید)', ['settlementId' => $id]); touchGroup($gid);
      if (!$auto) pushNote($to, 'پرداخت جدید برای تأیید', userName($from) . ' ' . toman($amount) . ' برایت واریز کرده — تأیید کن', $gid);
    });
    $s = $settlement($id); $s['amount'] = (int)$s['amount']; sendJson($s, 201);
  });
  route('POST', '/settlements/:id/confirm', function ($p) use ($settlement) {
    $me = requireAuth(); $s = $settlement($p['id']); if (!$s || $s['status'] !== 'pending_confirmation') throw badReq('این پرداخت قابل تأیید نیست', 'BAD_STATE'); if ($s['toUser'] !== $me) throw forbidden('فقط دریافت‌کننده می‌تواند تأیید کند');
    tx(function () use ($s, $me) { exec1('UPDATE settlements SET status = ?, confirmedAt = ?, updatedAt = ? WHERE id = ?', ['confirmed', nowIso(), nowIso(), $s['id']]); logAct($s['groupId'], $me, 'settlement_confirmed', userName($me) . ' دریافت ' . toman((int)$s['amount']) . ' از ' . userName($s['fromUser']) . ' را تأیید کرد', ['settlementId' => $s['id']]); touchGroup($s['groupId']); pushNote($s['fromUser'], 'پرداختت تأیید شد ✅', userName($me) . ' دریافت ' . toman((int)$s['amount']) . ' را تأیید کرد', $s['groupId']); });
    sendJson(['ok' => true]);
  });
  route('POST', '/settlements/:id/reject', function ($p) use ($settlement, $body) {
    $me = requireAuth(); $reason = trim(sval($body['reason'] ?? null, 'دلیل', 1)); $s = $settlement($p['id']); if (!$s || $s['status'] !== 'pending_confirmation') throw badReq('این پرداخت قابل رد نیست', 'BAD_STATE'); if ($s['toUser'] !== $me) throw forbidden('فقط دریافت‌کننده می‌تواند رد کند');
    tx(function () use ($s, $me, $reason) { exec1('UPDATE settlements SET status = ?, rejectReason = ?, updatedAt = ? WHERE id = ?', ['rejected', $reason, nowIso(), $s['id']]); logAct($s['groupId'], $me, 'settlement_rejected', userName($me) . ' پرداخت ' . toman((int)$s['amount']) . ' از ' . userName($s['fromUser']) . " را رد کرد: «{$reason}»", ['settlementId' => $s['id']]); touchGroup($s['groupId']); pushNote($s['fromUser'], 'پرداختت رد شد', userName($me) . ': ' . $reason, $s['groupId']); });
    sendJson(['ok' => true]);
  });
  route('DELETE', '/settlements/:id', function ($p) use ($settlement) { $me = requireAuth(); $s = $settlement($p['id']); if (!$s || $s['status'] !== 'pending_confirmation' || $s['fromUser'] !== $me) throw badReq('قابل لغو نیست', 'BAD_STATE'); exec1('DELETE FROM settlements WHERE id = ?', [$s['id']]); touchGroup($s['groupId']); sendJson(['ok' => true]); });

  /* ---------- reminders ---------- */
  route('POST', '/reminders', function () use ($body) {
    $me = requireAuth(); $gid = sval($body['groupId'] ?? null, 'گروه'); $target = sval($body['targetUserId'] ?? null, 'گیرنده'); $amount = ival($body['amount'] ?? null, 'مبلغ');
    requireMember($gid, $me); requireMember($gid, $target);
    $freq = $body['frequency'] ?? null; if ($freq !== null && !in_array($freq, ['once', 'every_1_day', 'every_2_days', 'every_3_days', 'weekly'], true)) $freq = null;
    $ex = row('SELECT * FROM reminders WHERE groupId = ? AND targetUserId = ?', [$gid, $target]);
    if ($ex && !empty($ex['lastSentAt']) && time() - strtotime($ex['lastSentAt']) < 86400) throw badReq('روزی فقط یک یادآوری می‌توانید بفرستید', 'RATE_LIMIT');
    tx(function () use ($ex, $gid, $target, $me, $freq, $amount) {
      if ($ex) exec1('UPDATE reminders SET lastSentAt = ?, active = 1, frequency = ? WHERE id = ?', [nowIso(), $freq ?? $ex['frequency'], $ex['id']]);
      else exec1('INSERT INTO reminders (id, groupId, targetUserId, createdBy, frequency, active, lastSentAt, createdAt) VALUES (?,?,?,?,?,1,?,?)', [newId(), $gid, $target, $me, $freq ?? 'every_3_days', nowIso(), nowIso()]);
      logAct($gid, $me, 'reminder_sent', userName($me) . ' برای ' . userName($target) . ' یادآوری بدهی ' . toman($amount) . ' فرستاد'); touchGroup($gid);
      pushNote($target, 'یادآوری دُنگ 🔔', userName($target) . '، ' . toman($amount) . ' به ' . userName($me) . ' بدهکاری', $gid);
    });
    sendJson(row('SELECT * FROM reminders WHERE groupId = ? AND targetUserId = ?', [$gid, $target]));
  });

  /* ---------- uploads ---------- */
  route('POST', '/uploads', function () use ($DATA) {
    requireAuth(); if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) throw badReq('فایل تصویر ارسال نشده', 'NO_FILE');
    $f = $_FILES['file']; if ($f['size'] > 3 * 1024 * 1024) throw badReq('حجم فایل بیش از حد مجاز است');
    $mime = function_exists('mime_content_type') ? mime_content_type($f['tmp_name']) : ($f['type'] ?? '');
    $ext = ['image/webp' => 'webp', 'image/png' => 'png', 'image/jpeg' => 'jpg'][$mime] ?? null; if (!$ext) throw badReq('فقط تصویر مجاز است');
    $name = bin2hex(random_bytes(12)) . '.' . $ext;
    if (!move_uploaded_file($f['tmp_name'], "$DATA/uploads/$name")) throw new HttpError(500, 'UPLOAD', 'ذخیرهٔ فایل ناموفق بود');
    sendJson(['url' => 'uploads/' . $name]);
  });
  route('GET', '/uploads/:name', function ($p) use ($DATA) {
    if (!preg_match('/^[a-f0-9]{24}\.(webp|png|jpg)$/', $p['name'])) throw notFound();
    $file = "$DATA/uploads/{$p['name']}"; if (!file_exists($file)) throw notFound();
    header('Content-Type: ' . ['webp' => 'image/webp', 'png' => 'image/png', 'jpg' => 'image/jpeg'][substr($p['name'], -4) === 'webp' ? 'webp' : substr($p['name'], -3)]);
    header('Cache-Control: public, max-age=2592000, immutable'); header('Content-Length: ' . filesize($file)); readfile($file); exit;
  });

  throw notFound('مسیر پیدا نشد: ' . $method . ' ' . $path);
} catch (HttpError $e) {
  sendJson(['code' => $e->code2, 'message' => $e->getMessage()], (int)$e->getCode());
} catch (Throwable $e) {
  sendJson(['code' => 'SERVER', 'message' => 'خطای سرور: ' . $e->getMessage()], 500);
}
