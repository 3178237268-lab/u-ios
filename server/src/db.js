'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

/* ── 数据目录（上传目录 / 数据库 / 备份都放在这里）─────────────
   优先级：环境变量 U_DATA_DIR > server/data-dir.json > 默认 server/data
   管理台可以改，改完写进 data-dir.json，重启后生效。
   历史上改过哪些目录记在 config_history 表里（管理台「修改记录」可查）。 */
const DATA_DIR_FILE = path.join(__dirname, '..', 'data-dir.json');
const DEFAULT_DATA_DIR = path.join(__dirname, '..', 'data');

function readDataDirConfig() {
  try {
    const raw = fs.readFileSync(DATA_DIR_FILE, 'utf8');
    const cfg = JSON.parse(raw);
    if (cfg && typeof cfg.dir === 'string' && cfg.dir.trim()) {
      return { dir: path.resolve(cfg.dir.trim()), source: 'config', updatedAt: cfg.updatedAt || null, by: cfg.by || null };
    }
  } catch (e) {
    /* 文件不存在或坏了，不致命，回默认目录 */
    if (e && e.code !== 'ENOENT') console.error('[data-dir] 读取 data-dir.json 失败：', e.message);
  }
  return { dir: null, source: 'default', updatedAt: null, by: null };
}

function resolveDataDir() {
  const envDir = (process.env.U_DATA_DIR || '').trim();
  if (envDir) return { dir: path.resolve(envDir), source: 'env' };
  const cfg = readDataDirConfig();
  if (cfg.dir) return { dir: cfg.dir, source: 'config', updatedAt: cfg.updatedAt, by: cfg.by };
  return { dir: DEFAULT_DATA_DIR, source: 'default' };
}

const DATA_INFO = resolveDataDir();
const DATA_DIR = DATA_INFO.dir;
const MEDIA_DIR = path.join(DATA_DIR, 'media');
fs.mkdirSync(MEDIA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'u.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  banned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions(
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS posts(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  private INTEGER NOT NULL DEFAULT 0,
  sensitive INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS media(
  id TEXT PRIMARY KEY,
  post_id INTEGER,
  user_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS comments(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  reply_to INTEGER NULL
);
CREATE TABLE IF NOT EXISTS likes(
  post_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(post_id, user_id)
);
CREATE TABLE IF NOT EXISTS follows(
  follower_id INTEGER NOT NULL,
  followed_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(follower_id, followed_id)
);
CREATE TABLE IF NOT EXISTS reposts(
  post_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(post_id, user_id)
);
CREATE TABLE IF NOT EXISTS direct_messages(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL,
  recipient_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT
);
CREATE TABLE IF NOT EXISTS notifications(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  actor_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  post_id INTEGER,
  text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  read_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_media_post ON media(post_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_followed ON follows(followed_id);
CREATE INDEX IF NOT EXISTS idx_reposts_user ON reposts(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON direct_messages(recipient_id, sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON direct_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at, created_at);
CREATE TABLE IF NOT EXISTS settings(
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS logs(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  user_id INTEGER,
  username TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_type ON logs(type);
/* 修改记录：数据目录、设置项、备份/恢复、清空数据这类「改了会影响全站」的操作都记一笔 */
CREATE TABLE IF NOT EXISTS config_history(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL,
  action TEXT NOT NULL,
  field TEXT NOT NULL DEFAULT '',
  old_value TEXT NOT NULL DEFAULT '',
  new_value TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_config_history_created ON config_history(created_at);
`);

/* 老库升级：游客标记列 */
const userCols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
if (!userCols.includes('is_guest')) {
  db.exec('ALTER TABLE users ADD COLUMN is_guest INTEGER NOT NULL DEFAULT 0');
}
/* 老库升级：禁言标记（禁言与封禁不同，禁言只禁止发帖/评论/转发） */
if (!userCols.includes('muted')) {
  db.exec('ALTER TABLE users ADD COLUMN muted INTEGER NOT NULL DEFAULT 0');
}
/* 老库升级：上次修改账号时间（普通用户一个月只能改一次） */
if (!userCols.includes('username_changed_at')) {
  db.exec('ALTER TABLE users ADD COLUMN username_changed_at TEXT');
}
/* 老库升级：真实浏览量（每次被看到 +1） */
const postCols = db.prepare('PRAGMA table_info(posts)').all().map((c) => c.name);
if (!postCols.includes('views')) {
  db.exec('ALTER TABLE posts ADD COLUMN views INTEGER NOT NULL DEFAULT 0');
}
/* 老库升级：18+ 标注独立成列。以前 privRow 那个开关直接写 private，导致标了 18+ 的帖
   被当成「仅自己可见」藏起来，别人当然看不到。private=只有我能看，sensitive=大家都能看但图要遮。 */
if (!postCols.includes('sensitive')) {
  db.exec('ALTER TABLE posts ADD COLUMN sensitive INTEGER NOT NULL DEFAULT 0');
  /* 迁移：历史上那个开关只有「18+ 内容」一个，勾了就被写成 private=1 藏起来。
     用户的本意是「别人能看、但要遮」，所以整体搬成 sensitive=1、private=0。 */
  try {
    const moved = db.prepare('UPDATE posts SET sensitive = 1, private = 0 WHERE private = 1').run();
    if (moved.changes) console.log('[db] 已把 ' + moved.changes + ' 条「18+ 标注」从 private 迁到 sensitive');
  } catch (e) {
    console.error('[db] 迁移 sensitive 标注失败：', e.message);
  }
}

/* 老库升级：人机标记。users.is_bot=1 表示这是自动内容账号（人机01…），
   posts/comments/media 的 bot=1 表示这条内容由人机产生，管理台据此显示 role */
if (!userCols.includes('is_bot')) {
  db.exec('ALTER TABLE users ADD COLUMN is_bot INTEGER NOT NULL DEFAULT 0');
}
if (!postCols.includes('bot')) {
  db.exec('ALTER TABLE posts ADD COLUMN bot INTEGER NOT NULL DEFAULT 0');
}
const mediaCols = db.prepare('PRAGMA table_info(media)').all().map((c) => c.name);
if (!mediaCols.includes('bot')) {
  db.exec('ALTER TABLE media ADD COLUMN bot INTEGER NOT NULL DEFAULT 0');
}
/* 老库升级：视频封面。poster 存的是「封面图那条 media 记录」的 id，
   这样别的用户拿到的封面是服务器上的图，而不是上传者本机的一串临时地址 */
if (!mediaCols.includes('poster')) {
  db.exec('ALTER TABLE media ADD COLUMN poster TEXT');
}
/* 老库升级：视频宽高比，客户端据此在信息流里占好位，避免加载时跳版 */
if (!mediaCols.includes('ratio')) {
  db.exec('ALTER TABLE media ADD COLUMN ratio REAL NOT NULL DEFAULT 0');
}

/* 昵称唯一：老库里如果有重名，先给后来的账号加后缀，避免建唯一索引失败 */
(function ensureUniqueNicknames() {
  const dups = db
    .prepare('SELECT lower(nickname) AS key, COUNT(*) AS n FROM users GROUP BY lower(nickname) HAVING n > 1')
    .all();
  dups.forEach((row) => {
    const rows = db
      .prepare('SELECT id, nickname FROM users WHERE lower(nickname) = ? ORDER BY id')
      .all(row.key);
    rows.slice(1).forEach((u) => {
      let next = u.nickname + '_' + u.id;
      while (db.prepare('SELECT 1 AS x FROM users WHERE nickname = ? COLLATE NOCASE').get(next)) {
        next += '_' + Math.floor(Math.random() * 1000);
      }
      db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run(next, u.id);
    });
  });
  try {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname COLLATE NOCASE)');
  } catch (e) {
    console.warn('[数据库] 昵称唯一索引创建失败：' + (e && e.message ? e.message : e));
  }
})();

/* 老库升级：评论回复 */
const commentCols = db.prepare('PRAGMA table_info(comments)').all().map((c) => c.name);
if (!commentCols.includes('reply_to')) {
  db.exec('ALTER TABLE comments ADD COLUMN reply_to INTEGER NULL');
}
/* 老库升级：评论的人机标记 */
if (!commentCols.includes('bot')) {
  db.exec('ALTER TABLE comments ADD COLUMN bot INTEGER NOT NULL DEFAULT 0');
}

const SESSION_DAYS = 30;
const now = () => new Date().toISOString();

function hashPassword(password, salt) {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), s, 64).toString('hex');
  return { salt: s, hash };
}

function verifyPassword(password, salt, hash) {
  const h = crypto.scryptSync(String(password), salt, 64);
  const target = Buffer.from(hash, 'hex');
  return h.length === target.length && crypto.timingSafeEqual(h, target);
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    nickname: u.nickname,
    isAdmin: !!u.is_admin,
    isGuest: !!u.is_guest,
    isBot: !!u.is_bot,
    banned: !!u.banned,
    muted: !!u.muted,
    createdAt: u.created_at,
    usernameChangedAt: u.username_changed_at || null,
    canChangeUsername: usernameChangeInfo(u).canChange
  };
}

/* 内容归属角色（管理台列表每行都会带 role）：
   admin = 管理员；bot = 人机（账号 is_bot=1 或内容 bot=1）；guest = 游客（含作者已删除）；
   user = 普通注册用户。判定顺序固定为 admin → bot → guest → user。 */
function contentRole({ is_admin: isAdmin, is_bot: isBot, is_guest: isGuest, username, bot } = {}) {
  if (isAdmin) return 'admin';
  if (isBot || bot) return 'bot';
  if (isGuest || /^guest_/i.test(String(username || ''))) return 'guest';
  return 'user';
}

/* 普通用户 30 天才能改一次账号，管理员不限次数 */
const USERNAME_COOLDOWN_MS = 30 * 86400000;
const BUILTIN_USERNAMES = ['admin', 'admin123'];
function usernameChangeInfo(u) {
  if (!u) return { canChange: false, nextAt: null };
  if (u.is_guest) return { canChange: false, nextAt: null, reason: '游客账号不支持修改' };
  if (BUILTIN_USERNAMES.indexOf(String(u.username || '').toLowerCase()) >= 0) {
    return { canChange: false, nextAt: null, reason: '内置账号不支持修改' };
  }
  if (u.is_admin) return { canChange: true, nextAt: null };
  const last = u.username_changed_at ? Date.parse(u.username_changed_at) : 0;
  if (!last) return { canChange: true, nextAt: null };
  const nextAt = last + USERNAME_COOLDOWN_MS;
  return { canChange: Date.now() >= nextAt, nextAt: new Date(nextAt).toISOString() };
}

function assertNickname(nickname, selfId) {
  const nick = String(nickname || '').trim();
  if (!nick) throw new Error('昵称不能为空');
  if (nick.length > 24) throw new Error('昵称最多 24 个字符');
  const row = db.prepare('SELECT id FROM users WHERE nickname = ? COLLATE NOCASE').get(nick);
  if (row && row.id !== selfId) throw new Error('该昵称已被使用');
  return nick;
}

function createUser({ username, nickname, password, isAdmin = false }) {
  const name = String(username || '').trim().toLowerCase();
  if (!/^[a-z0-9_]{2,24}$/.test(name)) {
    throw new Error('账号需为 2-24 位字母、数字或下划线');
  }
  if (String(password || '').length < 6) throw new Error('密码至少 6 位');
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(name)) {
    throw new Error('该账号已被注册');
  }
  const nick = assertNickname(String(nickname || '').trim() || name);
  const { salt, hash } = hashPassword(password);
  const info = db
    .prepare('INSERT INTO users(username, nickname, pass_hash, salt, is_admin, created_at) VALUES(?,?,?,?,?,?)')
    .run(name, nick, hash, salt, isAdmin ? 1 : 0, now());
  return db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
}

function findUserByName(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(String(username || '').trim().toLowerCase()) || null;
}

/* 游客账号：不设密码，只能由已发放的 token 使用 */
function createGuestUser() {
  for (let i = 0; i < 20; i++) {
    const digits = String(Math.floor(100000 + Math.random() * 900000));
    const name = 'guest_' + digits;
    const nick = '游客' + digits;
    if (findUserByName(name)) continue;
    if (db.prepare('SELECT id FROM users WHERE nickname = ? COLLATE NOCASE').get(nick)) continue;
    const { salt, hash } = hashPassword(crypto.randomBytes(24).toString('hex'));
    const info = db
      .prepare('INSERT INTO users(username, nickname, pass_hash, salt, is_admin, is_guest, created_at) VALUES(?,?,?,?,0,1,?)')
      .run(name, nick, hash, salt, now());
    return db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  }
  throw new Error('游客账号创建失败，请重试');
}

/* 人机随机昵称：自建词库，「词根 + 可选后缀 + 可选数字」拼成 2~4 字的自然昵称。
   仅用于新建人机账号；已有账号一律不改名（避免刷爆修改记录）。 */
const BOT_NICK_WORDS = [
  '晚风', '阿橘', '薄荷汽水', '路过的猫', '半糖', '南风', '小满', '拾光', '木木', '橘子海',
  '冬栗', '青梅', '野原', '一盏灯', '芋圆', '凌晨三点', '山止川行', '雾里看花', '栗子', '桃乌龙',
  '不困', '青柠', '月亮邮差', '慢半拍', '小城的雨', '西柚', '枕边风', '周末不出门', '黄油面包', '云朵收集者',
  '柚子糖', '阿柚', '小鹿', '海边散步', '城南', '麦芽', '懒觉', '一碗汤', '雨停了', '灯下'
];
const BOT_NICK_TAIL = ['', '', '', '', '同学', '本人', '呀', '酱', '日常', '小号', '在路上'];

function randomBotNickname() {
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const base = pick(BOT_NICK_WORDS) + pick(BOT_NICK_TAIL);
  /* 一半概率带 1~999 数字后缀，让它更像真人随手起的名字 */
  const digits = Math.random() < 0.5 ? String(1 + Math.floor(Math.random() * 999)) : '';
  return (base + digits).slice(0, 24);
}

/* 生成一个没被占用的随机昵称；撞名就重抽，最多 30 次 */
function uniqueBotNickname() {
  for (let i = 0; i < 30; i++) {
    const nick = randomBotNickname();
    const taken = db.prepare('SELECT id FROM users WHERE nickname = ? COLLATE NOCASE').get(nick);
    if (!taken) return nick;
  }
  return randomBotNickname() + String(Date.now() % 1000);
}

/* 人机账号：懒创建，编号 1..20，账号仍保持 bot_01 形式（便于识别与登录），密码随机。
   昵称随机（不再是「人机01」），但 is_bot=1，管理台 chip 依旧是「人机」。
   已经存在就直接复用，不会改名、不会重复建。 */
const BOT_MAX = 20;
function ensureBotUser(index) {
  const n = Math.min(BOT_MAX, Math.max(1, Math.round(Number(index) || 1)));
  const pad = String(n).padStart(2, '0');
  const handle = 'bot_' + pad;
  const found = findUserByName(handle);
  if (found) {
    if (!found.is_bot) db.prepare('UPDATE users SET is_bot = 1 WHERE id = ?').run(found.id);
    return found;
  }
  const nick = uniqueBotNickname();
  const { salt, hash } = hashPassword(crypto.randomBytes(24).toString('hex'));
  const insert = db.prepare(
    'INSERT INTO users(username, nickname, pass_hash, salt, is_admin, is_guest, is_bot, created_at)' +
    ' VALUES(?,?,?,?,0,0,1,?)'
  );
  let info;
  try {
    info = insert.run(handle, nick, hash, salt, now());
  } catch (e) {
    /* 昵称被人占了：换一个随机昵称再插一次 */
    info = insert.run(handle, uniqueBotNickname(), hash, salt, now());
  }
  return db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
}

/* 人机私信的目标：真实普通用户（非人机 / 非游客 / 非管理员 / 未封禁）。
   排序按「最近活跃」近似：最近发帖时间 → 最近评论时间 → 注册时间，都取不到的排最后。 */
function botDmTargets(limit = 20) {
  const n = Math.min(Math.max(Number(limit) || 20, 1), 100);
  return db
    .prepare(
      'SELECT id, username, nickname FROM (' +
        'SELECT u.id, u.username, u.nickname, u.created_at, ' +
        'COALESCE((SELECT MAX(p.created_at) FROM posts p WHERE p.user_id = u.id), \'\') AS last_post, ' +
        'COALESCE((SELECT MAX(c.created_at) FROM comments c WHERE c.user_id = u.id), \'\') AS last_comment ' +
        'FROM users u WHERE COALESCE(u.is_bot,0) = 0 AND COALESCE(u.is_admin,0) = 0 ' +
        'AND COALESCE(u.is_guest,0) = 0 AND COALESCE(u.banned,0) = 0 ' +
        'AND u.username NOT LIKE \'guest\\_%\' ESCAPE \'\\\'' +
        ') ORDER BY MAX(last_post, last_comment, created_at) DESC, id DESC LIMIT ?'
    )
    .all(n)
    .map((u) => ({ id: u.id, username: u.username, nickname: u.nickname }));
}

function ensureAdminUser(username, password, nickname) {
  const existing = findUserByName(username);
  if (existing) {
    if (!existing.is_admin) db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(existing.id);
    if (nickname && existing.nickname !== nickname) {
      db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run(nickname, existing.id);
    }
    return;
  }
  try {
    createUser({ username, nickname, password, isAdmin: true });
  } catch (e) {
    /* 昵称被普通用户占用时换一个官方后缀，避免服务器启动失败 */
    if (/昵称已被使用/.test(e.message || '')) {
      createUser({ username, nickname: nickname + '·官方', password, isAdmin: true });
      return;
    }
    throw e;
  }
}

function ensureAdmin() {
  /* 网页管理台管理员账号 */
  ensureAdminUser(
    (process.env.ADMIN_USER || 'admin123').toLowerCase(),
    process.env.ADMIN_PASS || 'admin123',
    '管理员'
  );
  /* App 内 U 官方账号（最高权限，发布内容进入「为你推荐」） */
  ensureAdminUser('admin', process.env.APP_OFFICIAL_PASS || '123456', 'U 官方');
}

function createSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  db.prepare('INSERT INTO sessions(token, user_id, created_at, expires_at) VALUES(?,?,?,?)').run(
    token,
    userId,
    now(),
    expires
  );
  return { token, expiresAt: expires };
}

function sessionUser(token) {
  if (!token) return null;
  const row = db
    .prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?')
    .get(token, now());
  return row || null;
}

function deleteSession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function mediaOf(postId) {
  return db
    .prepare('SELECT id, filename, mime, size, poster, ratio FROM media WHERE post_id = ? ORDER BY created_at ASC')
    .all(postId)
    .map((m) => ({
      id: m.id,
      url: '/media/' + m.id,
      mime: m.mime,
      size: m.size,
      name: m.filename,
      /* 视频封面：优先用上传者在服务器上传好的封面图，没有就留空让客户端兜底 */
      poster: m.poster ? '/media/' + m.poster : '',
      ratio: Number(m.ratio) || 0
    }));
}

/* 给已经上传过的视频补一张封面（本机抓到的首帧，或后来由 App 补传）。
   只允许改自己名下的媒体，返回是否真的写入 */
function setMediaPoster(mediaId, posterId, userId, ratio = 0) {
  const r = Math.max(0, Number(ratio) || 0);
  const info = db.prepare(
    'UPDATE media SET poster = ?, ratio = CASE WHEN ? > 0 THEN ? ELSE ratio END WHERE id = ? AND user_id = ?'
  ).run(String(posterId || ''), r, r, String(mediaId || ''), userId);
  return info.changes > 0;
}

/* 落库一个上传文件。bot=true 表示这条媒体由人机产生（管理台会把它标成 bot） */
function recordMedia({ id, userId, filename, mime, size = 0, bot = false }) {
  const fileId = String(id || '');
  if (!fileId) throw new Error('媒体 id 不能为空');
  db.prepare(
    'INSERT INTO media(id, post_id, user_id, filename, mime, size, bot, created_at) VALUES(?,?,?,?,?,?,?,?)'
  ).run(
    fileId,
    null,
    userId,
    String(filename || 'file').slice(0, 200),
    String(mime || 'application/octet-stream'),
    Math.max(0, Math.round(Number(size) || 0)),
    bot ? 1 : 0,
    now()
  );
  return fileId;
}

function serializePost(row, viewerId) {
  const media = mediaOf(row.id);
  const likeCount = db.prepare('SELECT COUNT(*) AS n FROM likes WHERE post_id = ?').get(row.id).n;
  const commentCount = db.prepare('SELECT COUNT(*) AS n FROM comments WHERE post_id = ?').get(row.id).n;
  const liked = viewerId
    ? !!db.prepare('SELECT 1 AS x FROM likes WHERE post_id = ? AND user_id = ?').get(row.id, viewerId)
    : false;
  const repostCount = db.prepare('SELECT COUNT(*) AS n FROM reposts WHERE post_id = ?').get(row.id).n;
  const reposted = viewerId
    ? !!db.prepare('SELECT 1 AS x FROM reposts WHERE post_id = ? AND user_id = ?').get(row.id, viewerId)
    : false;
  return {
    id: row.id,
    text: row.text,
    private: !!row.private,
    sensitive: !!row.sensitive,
    createdAt: row.created_at,
    author: { id: row.user_id, username: row.username, nickname: row.nickname, isAdmin: !!row.is_admin },
    media,
    likeCount,
    commentCount,
    liked,
    repostCount,
    reposted,
    viewCount: row.views || 0
  };
}

/* 浏览量：真实计数，每被看一次 +1，返回最新值 */
function bumpPostView(postId) {
  const row = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
  if (!row) return null;
  db.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').run(postId);
  return db.prepare('SELECT views FROM posts WHERE id = ?').get(postId).views;
}

/* 真实关注 / 粉丝 / 帖子数 */
function userCounts(userId) {
  return {
    followers: db.prepare('SELECT COUNT(*) AS n FROM follows WHERE followed_id = ?').get(userId).n,
    following: db.prepare('SELECT COUNT(*) AS n FROM follows WHERE follower_id = ?').get(userId).n,
    postCount: db.prepare('SELECT COUNT(*) AS n FROM posts WHERE user_id = ?').get(userId).n
  };
}

/* 直接建立关注关系（注册时官方账号与新用户互关用），已存在则忽略 */
function linkFollow(followerId, followedId) {
  if (!followerId || !followedId || followerId === followedId) return false;
  db.prepare('INSERT OR IGNORE INTO follows(follower_id, followed_id, created_at) VALUES(?,?,?)')
    .run(followerId, followedId, now());
  return true;
}

/* 真实关注 / 粉丝列表 */
function userFollowList(username, kind = 'followers', viewerId = 0) {
  const u = findUserByName(username);
  if (!u) return null;
  const sql =
    kind === 'following'
      ? 'SELECT x.* FROM follows f JOIN users x ON x.id = f.followed_id WHERE f.follower_id = ? ORDER BY f.created_at DESC LIMIT 200'
      : 'SELECT x.* FROM follows f JOIN users x ON x.id = f.follower_id WHERE f.followed_id = ? ORDER BY f.created_at DESC LIMIT 200';
  return db.prepare(sql).all(u.id).map((x) => {
    const isFollowing = viewerId
      ? !!db.prepare('SELECT 1 AS x FROM follows WHERE follower_id = ? AND followed_id = ?').get(viewerId, x.id)
      : false;
    return Object.assign(publicUser(x), { isFollowing });
  });
}

/* 官方账号：优先 u_official，其次最早的管理员 */
function findOfficialUser() {
  return (
    db.prepare("SELECT * FROM users WHERE username = 'u_official'").get() ||
    db.prepare('SELECT * FROM users WHERE is_admin = 1 ORDER BY id ASC LIMIT 1').get() ||
    null
  );
}

/* 新注册账号：与官方账号真实互相关注，关注/粉丝数字都来自 follows 表 */
function welcomeNewUser(userId) {
  const official = findOfficialUser();
  if (!official || official.id === userId) return null;
  linkFollow(userId, official.id);
  linkFollow(official.id, userId);
  addNotification(userId, official.id, 'follow', null, '');
  return official;
}

function listPosts({ viewerId = 0, authorId = 0, offset = 0, limit = 20 } = {}) {
  /* 私密帖只对作者本人可见，否则任何人都能从时间线里读到 */
  const where = ['(p.private = 0 OR p.user_id = ?)'];
  const params = [viewerId || 0];
  if (authorId) {
    where.push('p.user_id = ?');
    params.push(authorId);
  }
  const sql =
    'SELECT p.*, u.username, u.nickname, u.is_admin FROM posts p JOIN users u ON u.id = p.user_id' +
    (where.length ? ' WHERE ' + where.join(' AND ') : '') +
    ' ORDER BY p.id DESC LIMIT ? OFFSET ?';
  const rows = db.prepare(sql).all(...params, Math.min(Math.max(limit, 1), 100), Math.max(offset, 0));
  return rows.map((r) => serializePost(r, viewerId));
}

function getPost(id, viewerId) {
  const row = db
    .prepare('SELECT p.*, u.username, u.nickname, u.is_admin FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = ?')
    .get(id);
  if (!row) return null;
  /* 私密帖对非作者一律当作不存在，评论/详情/转发等入口都靠这里判权 */
  if (row.private && row.user_id !== (viewerId || 0)) return null;
  return serializePost(row, viewerId);
}

function createPost({ userId, text, private: isPrivate = false, sensitive = false, mediaIds = [], bot = false }) {
  const body = String(text || '').slice(0, 5000);
  /* 客户端可以传 ['媒体id', ...]，也可以传 [{ id, poster, ratio }]：
     poster 是这条视频的封面（另一条 media 记录的 id），ratio 是宽高比 */
  const wanted = (Array.isArray(mediaIds) ? mediaIds.slice(0, 9) : []).map((x) =>
    x && typeof x === 'object'
      ? {
          id: String(x.id || ''),
          poster: x.poster ? String(x.poster) : '',
          ratio: Math.max(0, Math.min(10, Number(x.ratio) || 0))
        }
      : { id: String(x), poster: '', ratio: 0 }
  );
  /* 只保留真实存在、属于自己、且还没绑定到帖子上的媒体，避免伪造 id 撑起空帖 */
  const probe = db.prepare('SELECT id FROM media WHERE id = ? AND user_id = ? AND post_id IS NULL');
  const ids = wanted.filter((it) => it.id && !!probe.get(it.id, userId));
  /* 客户端点名要带的媒体只要有一个挂不上就直接报错，不能静默丢掉后悄悄发一条纯文本帖 */
  if (wanted.length && ids.length !== wanted.length) throw new Error('媒体不存在或已被使用');
  if (!body.trim() && ids.length === 0) throw new Error('内容不能为空');
  const info = db
    .prepare('INSERT INTO posts(user_id, text, private, sensitive, bot, created_at) VALUES(?,?,?,?,?,?)')
    .run(userId, body, isPrivate ? 1 : 0, sensitive ? 1 : 0, bot ? 1 : 0, now());
  const postId = info.lastInsertRowid;
  const attach = db.prepare(
    'UPDATE media SET post_id = ?, poster = ?, ratio = ? WHERE id = ? AND user_id = ? AND post_id IS NULL'
  );
  /* 封面只认同一个人上传的媒体，避免把别人的文件 id 拼进来 */
  const posterOk = db.prepare('SELECT id FROM media WHERE id = ? AND user_id = ?');
  ids.forEach((it) => {
    const poster = it.poster && posterOk.get(it.poster, userId) ? it.poster : '';
    attach.run(postId, poster, it.ratio || 0, it.id, userId);
  });
  return postId;
}

function deletePost(postId) {
  const files = db.prepare('SELECT id, poster FROM media WHERE post_id = ?').all(postId);
  /* 视频封面是另一条 media 记录，删帖时要一起清掉，否则会留下孤儿文件 */
  const posters = files.map((m) => m.poster).filter(Boolean);
  db.prepare('DELETE FROM likes WHERE post_id = ?').run(postId);
  db.prepare('DELETE FROM reposts WHERE post_id = ?').run(postId);
  db.prepare('DELETE FROM comments WHERE post_id = ?').run(postId);
  db.prepare('DELETE FROM notifications WHERE post_id = ?').run(postId);
  if (posters.length) {
    const delOne = db.prepare('DELETE FROM media WHERE id = ?');
    posters.forEach((p) => delOne.run(p));
  }
  db.prepare('DELETE FROM media WHERE post_id = ?').run(postId);
  db.prepare('DELETE FROM posts WHERE id = ?').run(postId);
  files.forEach((f) => {
    [f.id, f.poster].forEach((fileId) => {
      if (!fileId) return;
      try {
        fs.unlinkSync(path.join(MEDIA_DIR, fileId));
      } catch (e) {
        /* 文件可能已被清理 */
      }
    });
  });
}

/* 编辑已发布帖子的可改项：文字 / 仅自己可见 / 18+ 标注（媒体不在这里改） */
function updatePostMeta(postId, userId, patch = {}) {
  const row = db.prepare('SELECT text, private, sensitive FROM posts WHERE id = ? AND user_id = ?').get(postId, userId);
  if (!row) return null;
  const text = patch.text === undefined ? row.text : String(patch.text || '').slice(0, 5000);
  const priv = patch.private === undefined ? row.private : patch.private ? 1 : 0;
  const sens = patch.sensitive === undefined ? row.sensitive : patch.sensitive ? 1 : 0;
  const mediaCount = db.prepare('SELECT COUNT(*) AS n FROM media WHERE post_id = ?').get(postId).n;
  if (!String(text).trim() && !mediaCount) throw new Error('内容不能为空');
  db.prepare('UPDATE posts SET text = ?, private = ?, sensitive = ? WHERE id = ? AND user_id = ?')
    .run(text, priv, sens, postId, userId);
  return getPost(postId, userId);
}

function toggleLike(postId, userId) {
  const exists = db.prepare('SELECT 1 AS x FROM likes WHERE post_id = ? AND user_id = ?').get(postId, userId);
  if (exists) {
    db.prepare('DELETE FROM likes WHERE post_id = ? AND user_id = ?').run(postId, userId);
  } else {
    db.prepare('INSERT INTO likes(post_id, user_id, created_at) VALUES(?,?,?)').run(postId, userId, now());
    const post = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(postId);
    if (post) addNotification(post.user_id, userId, 'like', postId, '');
  }
  const likeCount = db.prepare('SELECT COUNT(*) AS n FROM likes WHERE post_id = ?').get(postId).n;
  return { liked: !exists, likeCount };
}

function toggleRepost(postId, userId) {
  const exists = db.prepare('SELECT 1 AS x FROM reposts WHERE post_id = ? AND user_id = ?').get(postId, userId);
  if (exists) {
    db.prepare('DELETE FROM reposts WHERE post_id = ? AND user_id = ?').run(postId, userId);
  } else {
    db.prepare('INSERT INTO reposts(post_id, user_id, created_at) VALUES(?,?,?)').run(postId, userId, now());
  }
  const repostCount = db.prepare('SELECT COUNT(*) AS n FROM reposts WHERE post_id = ?').get(postId).n;
  return { reposted: !exists, repostCount };
}

function addComment(postId, userId, text, replyTo, bot = false) {
  const body = String(text || '').trim().slice(0, 1000);
  if (!body) throw new Error('评论不能为空');
  const parentId = replyTo === undefined || replyTo === null || replyTo === '' ? null : Number(replyTo);
  let parent = null;
  if (parentId !== null) {
    parent = Number.isInteger(parentId) && parentId > 0
      ? db.prepare('SELECT id, user_id FROM comments WHERE id = ? AND post_id = ?').get(parentId, postId)
      : null;
    if (!parent) throw new Error('回复的评论不存在或不属于该帖');
  }
  const info = db
    .prepare('INSERT INTO comments(post_id, user_id, text, created_at, reply_to, bot) VALUES(?,?,?,?,?,?)')
    .run(postId, userId, body, now(), parentId, bot ? 1 : 0);
  const post = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(postId);
  if (post) addNotification(post.user_id, userId, 'reply', postId, body);
  if (parent && (!post || parent.user_id !== post.user_id)) {
    addNotification(parent.user_id, userId, 'reply', postId, body);
  }
  return info.lastInsertRowid;
}

function replyToOf(c) {
  if (!c.replyId || !c.replyUsername) return null;
  return { id: c.replyId, username: c.replyUsername, nickname: c.replyNickname };
}

function listComments(postId, limit = 100) {
  return db
    .prepare(
      'SELECT c.id, c.text, c.created_at AS createdAt, u.id AS userId, u.username, u.nickname, ' +
        'r.id AS replyId, ru.username AS replyUsername, ru.nickname AS replyNickname ' +
        'FROM comments c JOIN users u ON u.id = c.user_id ' +
        'LEFT JOIN comments r ON r.id = c.reply_to LEFT JOIN users ru ON ru.id = r.user_id ' +
        'WHERE c.post_id = ? ORDER BY c.id ASC LIMIT ?'
    )
    .all(postId, Math.min(Math.max(limit, 1), 200))
    .map((c) => ({
      id: c.id,
      text: c.text,
      createdAt: c.createdAt,
      author: { id: c.userId, username: c.username, nickname: c.nickname },
      replyTo: replyToOf(c)
    }));
}

function userProfile(username, viewerId = 0) {
  const u = findUserByName(username);
  if (!u) return null;
  const postCount = db.prepare('SELECT COUNT(*) AS n FROM posts WHERE user_id = ?').get(u.id).n;
  const followers = db.prepare('SELECT COUNT(*) AS n FROM follows WHERE followed_id = ?').get(u.id).n;
  const following = db.prepare('SELECT COUNT(*) AS n FROM follows WHERE follower_id = ?').get(u.id).n;
  const isFollowing = viewerId
    ? !!db.prepare('SELECT 1 AS x FROM follows WHERE follower_id = ? AND followed_id = ?').get(viewerId, u.id)
    : false;
  const isFollower = viewerId
    ? !!db.prepare('SELECT 1 AS x FROM follows WHERE follower_id = ? AND followed_id = ?').get(u.id, viewerId)
    : false;
  return { user: Object.assign(publicUser(u), { postCount }), followers, following, isFollowing, isFollower };
}

function toggleFollow(userId, targetId) {
  if (userId === targetId) throw new Error('不能关注自己');
  const exists = db
    .prepare('SELECT 1 AS x FROM follows WHERE follower_id = ? AND followed_id = ?')
    .get(userId, targetId);
  if (exists) {
    db.prepare('DELETE FROM follows WHERE follower_id = ? AND followed_id = ?').run(userId, targetId);
  } else {
    db.prepare('INSERT INTO follows(follower_id, followed_id, created_at) VALUES(?,?,?)').run(userId, targetId, now());
    addNotification(targetId, userId, 'follow', null, '');
  }
  const followers = db.prepare('SELECT COUNT(*) AS n FROM follows WHERE followed_id = ?').get(targetId).n;
  const isFollower = !!db
    .prepare('SELECT 1 AS x FROM follows WHERE follower_id = ? AND followed_id = ?')
    .get(targetId, userId);
  return { following: !exists, followers, isFollower };
}

function userActivity(username, viewerId = 0) {
  const u = findUserByName(username);
  if (!u) return null;
  const posts = db
    .prepare(
      'SELECT p.*, u.username, u.nickname, u.is_admin FROM posts p JOIN users u ON u.id = p.user_id ' +
        'WHERE p.user_id = ? AND (p.private = 0 OR p.user_id = ?) ORDER BY p.id DESC'
    )
    .all(u.id, viewerId || 0)
    .map((p) => serializePost(p, viewerId));
  const reposts = db
    .prepare(
      'SELECT p.*, u.username, u.nickname, u.is_admin FROM reposts r JOIN posts p ON p.id = r.post_id ' +
        'JOIN users u ON u.id = p.user_id WHERE r.user_id = ? AND (p.private = 0 OR p.user_id = ?) ' +
        'ORDER BY r.created_at DESC, r.rowid DESC'
    )
    .all(u.id, viewerId || 0)
    .map((p) => serializePost(p, viewerId));
  const likes = db
    .prepare(
      'SELECT p.*, u.username, u.nickname, u.is_admin FROM likes l JOIN posts p ON p.id = l.post_id ' +
        'JOIN users u ON u.id = p.user_id WHERE l.user_id = ? AND (p.private = 0 OR p.user_id = ?) ' +
        'ORDER BY l.created_at DESC, l.rowid DESC'
    )
    .all(u.id, viewerId || 0)
    .map((p) => serializePost(p, viewerId));
  const comments = db
    .prepare(
      'SELECT c.id, c.post_id AS postId, c.text, c.created_at AS createdAt, ' +
        'u.id AS userId, u.username, u.nickname, r.id AS replyId, ' +
        'ru.username AS replyUsername, ru.nickname AS replyNickname ' +
        'FROM comments c JOIN users u ON u.id = c.user_id ' +
        'LEFT JOIN comments r ON r.id = c.reply_to LEFT JOIN users ru ON ru.id = r.user_id ' +
        'WHERE c.user_id = ? ORDER BY c.created_at DESC, c.id DESC'
    )
    .all(u.id)
    .map((c) => ({
      id: c.id,
      postId: c.postId,
      text: c.text,
      createdAt: c.createdAt,
      author: { id: c.userId, username: c.username, nickname: c.nickname },
      replyTo: replyToOf(c)
    }));
  return { posts, reposts, likes, comments };
}

function search(q, viewerId = 0) {
  const term = String(q || '').trim();
  if (!term) return { users: [], posts: [] };
  const like = '%' + term + '%';
  const users = db
    .prepare('SELECT * FROM users WHERE username LIKE ? OR nickname LIKE ? ORDER BY id DESC LIMIT 50')
    .all(like, like)
    .map(publicUser);
  const posts = db
    .prepare(
      'SELECT p.*, u.username, u.nickname, u.is_admin FROM posts p JOIN users u ON u.id = p.user_id ' +
        'WHERE (p.text LIKE ? OR u.username LIKE ? OR u.nickname LIKE ?) ' +
        'AND (p.private = 0 OR p.user_id = ?) ORDER BY p.id DESC LIMIT 50'
    )
    .all(like, like, like, viewerId || 0)
    .map((p) => serializePost(p, viewerId));
  return { users, posts };
}

function listConversations(userId) {
  const rows = db
    .prepare(
      'SELECT m.*, CASE WHEN m.sender_id = ? THEN m.recipient_id ELSE m.sender_id END AS otherId ' +
        'FROM direct_messages m WHERE m.sender_id = ? OR m.recipient_id = ? ORDER BY m.created_at DESC, m.id DESC'
    )
    .all(userId, userId, userId);
  const seen = new Set();
  const conversations = [];
  rows.forEach((m) => {
    if (seen.has(m.otherId)) return;
    seen.add(m.otherId);
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(m.otherId);
    if (!u) return;
    const unread = m.otherId === userId
      ? 0
      : db.prepare(
          'SELECT COUNT(*) AS n FROM direct_messages WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL'
        ).get(m.otherId, userId).n;
    conversations.push({
      user: publicUser(u),
      lastMessage: { id: m.id, text: m.text, fromMe: m.sender_id === userId, createdAt: m.created_at },
      unread
    });
  });
  return conversations;
}

function listMessages(userId, otherId) {
  db.prepare(
    'UPDATE direct_messages SET read_at = ? WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL'
  ).run(now(), otherId, userId);
  return db
    .prepare(
      'SELECT * FROM direct_messages WHERE (sender_id = ? AND recipient_id = ?) OR ' +
        '(sender_id = ? AND recipient_id = ?) ORDER BY created_at ASC, id ASC'
    )
    .all(userId, otherId, otherId, userId)
    .map((m) => ({ id: m.id, text: m.text, fromMe: m.sender_id === userId, createdAt: m.created_at }));
}

function sendMessage(senderId, recipientId, text) {
  const body = String(text || '').trim();
  if (!body) throw new Error('私信不能为空');
  if (body.length > 1000) throw new Error('私信最多 1000 字');
  const createdAt = now();
  const info = db
    .prepare('INSERT INTO direct_messages(sender_id, recipient_id, text, created_at) VALUES(?,?,?,?)')
    .run(senderId, recipientId, body, createdAt);
  return { id: info.lastInsertRowid, text: body, fromMe: true, createdAt };
}

function addNotification(userId, actorId, type, postId, text) {
  if (!userId || userId === actorId) return;
  db.prepare(
    'INSERT INTO notifications(user_id, actor_id, type, post_id, text, created_at) VALUES(?,?,?,?,?,?)'
  ).run(userId, actorId, type, postId || null, String(text || '').slice(0, 1000), now());
}

function listNotifications(userId, limit = 100) {
  return db.prepare(
    'SELECT n.*, u.username, u.nickname, p.text AS postText FROM notifications n ' +
    'JOIN users u ON u.id = n.actor_id LEFT JOIN posts p ON p.id = n.post_id ' +
    'WHERE n.user_id = ? ORDER BY n.id DESC LIMIT ?'
  ).all(userId, Math.min(Math.max(limit, 1), 200)).map((n) => ({
    id: n.id,
    type: n.type,
    actor: { id: n.actor_id, username: n.username, nickname: n.nickname },
    postId: n.post_id,
    postText: n.postText || '',
    text: n.text,
    createdAt: n.created_at,
    read: !!n.read_at
  }));
}

function markNotificationsRead(userId, ids) {
  if (Array.isArray(ids) && ids.length) {
    const validIds = ids.map(Number).filter((id) => Number.isInteger(id) && id > 0);
    if (!validIds.length) return;
    const placeholders = validIds.map(() => '?').join(',');
    db.prepare(
      'UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL AND id IN (' + placeholders + ')'
    ).run(now(), userId, ...validIds);
    return;
  }
  db.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(now(), userId);
}

/* 管理台「用户管理」的查询条件：关键词 + 人物（admin / bot / guest / user）。
   人物条件复用 adminRoleWhere()，保证列表里的 role 字段和筛选项永远出自同一套判定；
   users 表没有 posts.bot，botFlag 传常量 0，于是「人机」只看 u.is_bot。 */
function adminUsersWhere(q = '', role = '') {
  const like = '%' + String(q || '').trim() + '%';
  const where = ['(u.username LIKE ? OR u.nickname LIKE ?)'];
  const params = [like, like];
  const roleWhere = adminRoleWhere(role, { botFlag: '0' });
  if (roleWhere) where.push(roleWhere);
  return { sql: where.join(' AND '), params };
}

function adminUsers(q = '', role = '') {
  const w = adminUsersWhere(q, role);
  return db
    .prepare(
      'SELECT u.*, (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id) AS post_count ' +
        'FROM users u WHERE ' + w.sql + ' ORDER BY u.id DESC LIMIT 500'
    )
    .all(...w.params)
    .map((u) => Object.assign(publicUser(u), { postCount: u.post_count, role: contentRole(u) }));
}

function adminUsersTotal(q = '', role = '') {
  const w = adminUsersWhere(q, role);
  return db.prepare('SELECT COUNT(*) AS n FROM users u WHERE ' + w.sql).get(...w.params).n;
}

/* 管理台「发布者身份」筛选：把 contentRole() 的判定顺序（admin → bot → guest → user）
   翻译成 SQL 条件，保证 ?role=xxx 过滤出的行与列表里的 role 字段完全一致。
   bot / guest / user 都先排除管理员，避免同一个账号同时命中两类。 */
const ADMIN_ROLE_FILTERS = ['admin', 'bot', 'guest', 'user'];

function adminRoleWhere(role, cols = {}) {
  const r = String(role || '').trim().toLowerCase();
  if (!r || ADMIN_ROLE_FILTERS.indexOf(r) < 0) return null;
  const isAdmin = 'COALESCE(' + (cols.isAdmin || 'u.is_admin') + ', 0)';
  const isBot = 'COALESCE(' + (cols.isBot || 'u.is_bot') + ', 0)';
  const isGuest = 'COALESCE(' + (cols.isGuest || 'u.is_guest') + ', 0)';
  const botFlag = 'COALESCE(' + (cols.botFlag || 'p.bot') + ', 0)';
  const username = cols.username || 'u.username';
  const guestName = '(' + username + " LIKE 'guest\\_%' ESCAPE '\\')";
  if (r === 'admin') return isAdmin + ' = 1';
  if (r === 'bot') return isAdmin + ' = 0 AND (' + isBot + ' = 1 OR ' + botFlag + ' = 1)';
  if (r === 'guest') {
    return isAdmin + ' = 0 AND ' + isBot + ' = 0 AND ' + botFlag + ' = 0 AND (' + isGuest + ' = 1 OR ' + guestName + ')';
  }
  /* user：非管理员、非人机、非游客 */
  return isAdmin + ' = 0 AND ' + isBot + ' = 0 AND ' + botFlag + ' = 0 AND ' + isGuest + ' = 0 AND (' +
    username + ' IS NULL OR NOT ' + guestName + ')';
}

function adminPosts({ q = '', role = '', offset = 0, limit = 50 } = {}) {
  const kw = String(q || '').trim();
  const where = [];
  const params = [];
  if (kw) {
    const like = '%' + kw + '%';
    where.push('(p.text LIKE ? OR u.username LIKE ? OR u.nickname LIKE ?)');
    params.push(like, like, like);
  }
  const roleWhere = adminRoleWhere(role, { botFlag: 'p.bot' });
  if (roleWhere) where.push(roleWhere);
  return db
    .prepare(
      'SELECT p.*, u.username, u.nickname, u.is_admin, u.is_bot, ' +
        '(SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count, ' +
        '(SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count ' +
        'FROM posts p JOIN users u ON u.id = p.user_id ' +
        (where.length ? 'WHERE ' + where.join(' AND ') + ' ' : '') +
        'ORDER BY p.id DESC LIMIT ? OFFSET ?'
    )
    .all(...params, Math.min(Math.max(limit, 1), 200), Math.max(offset, 0))
    .map((p) => ({
      id: p.id,
      text: p.text,
      private: !!p.private,
      sensitive: !!p.sensitive,
      views: p.views || 0,
      bot: !!p.bot,
      role: contentRole(p),
      createdAt: p.created_at,
      author: { id: p.user_id, username: p.username, nickname: p.nickname },
      likeCount: p.like_count,
      commentCount: p.comment_count,
      mediaCount: db.prepare('SELECT COUNT(*) AS n FROM media WHERE post_id = ?').get(p.id).n
    }));
}

/* 帖子总数：与 adminPosts 用同一套过滤条件，保证 total 和 role 过滤后的行数一致 */
function adminPostsTotal({ q = '', role = '' } = {}) {
  const kw = String(q || '').trim();
  const where = [];
  const params = [];
  if (kw) {
    const like = '%' + kw + '%';
    where.push('(p.text LIKE ? OR u.username LIKE ? OR u.nickname LIKE ?)');
    params.push(like, like, like);
  }
  const roleWhere = adminRoleWhere(role, { botFlag: 'p.bot' });
  if (roleWhere) where.push(roleWhere);
  return db
    .prepare(
      'SELECT COUNT(*) AS n FROM posts p JOIN users u ON u.id = p.user_id' +
        (where.length ? ' WHERE ' + where.join(' AND ') : '')
    )
    .get(...params).n;
}

function adminCommentFilters({ q = '', postId = 0, role = '' } = {}) {
  const like = '%' + String(q || '').trim() + '%';
  const where = [];
  const params = [];
  if (postId) {
    where.push('c.post_id = ?');
    params.push(postId);
  }
  if (String(q || '').trim()) {
    where.push('(c.text LIKE ? OR u.username LIKE ? OR u.nickname LIKE ? OR p.text LIKE ?)');
    params.push(like, like, like, like);
  }
  const roleWhere = adminRoleWhere(role, { botFlag: 'c.bot' });
  if (roleWhere) where.push(roleWhere);
  return { where, params };
}

function adminComments({ q = '', postId = 0, role = '', offset = 0, limit = 100 } = {}) {
  const { where, params } = adminCommentFilters({ q, postId, role });
  return db
    .prepare(
      'SELECT c.id, c.post_id, c.text, c.created_at, c.bot, u.username, u.nickname, u.is_guest, u.is_admin, u.is_bot, p.text AS post_text ' +
        'FROM comments c JOIN users u ON u.id = c.user_id JOIN posts p ON p.id = c.post_id ' +
        (where.length ? ' WHERE ' + where.join(' AND ') : '') +
        ' ORDER BY c.id DESC LIMIT ? OFFSET ?'
    )
    .all(...params, Math.min(Math.max(limit, 1), 300), Math.max(offset, 0))
    .map((c) => ({
      id: c.id,
      postId: c.post_id,
      text: c.text,
      bot: !!c.bot,
      role: contentRole(c),
      createdAt: c.created_at,
      postText: String(c.post_text || '').slice(0, 60),
      author: { username: c.username, nickname: c.nickname, isGuest: !!c.is_guest }
    }));
}

function adminCommentsTotal({ q = '', postId = 0, role = '' } = {}) {
  const { where, params } = adminCommentFilters({ q, postId, role });
  return db
    .prepare(
      'SELECT COUNT(*) AS n FROM comments c JOIN users u ON u.id = c.user_id JOIN posts p ON p.id = c.post_id' +
        (where.length ? ' WHERE ' + where.join(' AND ') : '')
    )
    .get(...params).n;
}

function deleteComment(id) {
  db.prepare('UPDATE comments SET reply_to = NULL WHERE reply_to = ?').run(id);
  db.prepare('DELETE FROM comments WHERE id = ?').run(id);
}

function deleteMedia(id) {
  const row = db.prepare('SELECT id, post_id FROM media WHERE id = ?').get(String(id));
  if (!row) return false;
  /* 媒体是帖子的组成部分：删除媒体时连带删除所属帖子，避免留下空壳或坏图帖子 */
  if (row.post_id) {
    deletePost(row.post_id);
    return true;
  }
  db.prepare('DELETE FROM media WHERE id = ?').run(String(id));
  try { fs.unlinkSync(path.join(MEDIA_DIR, row.id)); } catch (e) { /* 文件可能已清理 */ }
  return true;
}

function deleteManyPosts(ids) {
  (Array.isArray(ids) ? ids : []).forEach((id) => deletePost(Number(id)));
}

function deleteManyComments(ids) {
  (Array.isArray(ids) ? ids : []).forEach((id) => deleteComment(Number(id)));
}

function deleteManyMedia(ids) {
  (Array.isArray(ids) ? ids : []).forEach((id) => deleteMedia(String(id)));
}

function deleteAllPosts() {
  db.prepare('SELECT id FROM posts').all().forEach((p) => deletePost(p.id));
}

function deleteAllComments() {
  db.prepare("DELETE FROM notifications WHERE type IN ('comment', 'reply')").run();
  db.prepare('DELETE FROM comments').run();
}

function deleteAllMedia() {
  db.prepare('SELECT id FROM media').all().forEach((m) => deleteMedia(m.id));
}

function adminMedia({ q = '', role = '', offset = 0, limit = 100 } = {}) {
  const hasQ = !!String(q || '').trim();
  const like = '%' + String(q || '').trim() + '%';
  const where = [];
  const params = [];
  if (hasQ) {
    where.push('(m.filename LIKE ? OR u.username LIKE ? OR u.nickname LIKE ?)');
    params.push(like, like, like);
  }
  /* 媒体没有归属账号时 contentRole() 返回 user，这里保持同样的判定 */
  const roleWhere = adminRoleWhere(role, { botFlag: 'm.bot' });
  if (roleWhere) where.push(roleWhere);
  /* 视频封面图是视频的附属品，不在媒体列表里单独占一行 */
  where.push("m.id NOT IN (SELECT poster FROM media WHERE poster IS NOT NULL AND poster <> '')");
  const sql =
    'SELECT m.id, m.post_id, m.filename, m.mime, m.size, m.created_at, m.bot, ' +
    'u.username, u.nickname, u.is_admin, u.is_bot, p.text AS post_text ' +
    'FROM media m LEFT JOIN users u ON u.id = m.user_id LEFT JOIN posts p ON p.id = m.post_id ' +
    (where.length ? 'WHERE ' + where.join(' AND ') + ' ' : '') +
    'ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
  return db
    .prepare(sql)
    .all(...params, Math.min(Math.max(limit, 1), 300), Math.max(offset, 0))
    .map((m) => ({
      id: m.id,
      postId: m.post_id,
      filename: m.filename,
      mime: m.mime,
      size: m.size,
      bot: !!m.bot,
      role: contentRole(m),
      createdAt: m.created_at,
      isVideo: /^video\//.test(m.mime || ''),
      author: { username: m.username || '', nickname: m.nickname || '' },
      postText: String(m.post_text || '').slice(0, 60)
    }));
}

function adminMediaTotal({ q = '', role = '' } = {}) {
  const hasQ = !!String(q || '').trim();
  const like = '%' + String(q || '').trim() + '%';
  const where = [];
  const params = [];
  if (hasQ) {
    where.push('(m.filename LIKE ? OR u.username LIKE ? OR u.nickname LIKE ?)');
    params.push(like, like, like);
  }
  const roleWhere = adminRoleWhere(role, { botFlag: 'm.bot' });
  if (roleWhere) where.push(roleWhere);
  where.push("m.id NOT IN (SELECT poster FROM media WHERE poster IS NOT NULL AND poster <> '')");
  return db
    .prepare(
      'SELECT COUNT(*) AS n FROM media m LEFT JOIN users u ON u.id = m.user_id' +
        (where.length ? ' WHERE ' + where.join(' AND ') : '')
    )
    .get(...params).n;
}

function setBanned(userId, banned) {
  db.prepare('UPDATE users SET banned = ? WHERE id = ?').run(banned ? 1 : 0, userId);
  /* 保留会话：App 端凭 token 调用受保护接口时会收到 403「账号已被封禁」，
     从而在客户端锁定界面并弹出封禁提示 */
}

/* ---------------- 站点设置（上传大小 / 全站开关 / 菜单开关） ---------------- */

const SERVICE_KEYS = ['recommend', 'talk', 'search', 'notify', 'dm', 'memo', 'compose', 'lan', 'game'];
const DEFAULT_SETTINGS = {
  uploadImageMB: 50,
  uploadVideoMB: 200,
  allowPost: true,
  allowComment: true,
  hiddenServices: [],
  mediaMaxPerPost: 9,
  /* 自动备份：每 autoBackupHours 小时存一份，只保留最近 backupKeep 份 */
  autoBackupHours: 24,
  backupKeep: 5,
  botIntervalSec: 20,
  botCommentPerSec: 0,
  botLikePerSec: 0,
  botPostPerSec: 0,
  botDmPerSec: 0,
  /* 新模型：每 botXxxEverySec 秒做 botXxxPerRound 条（PerRound = 0 即关闭） */
  botPostEverySec: 20,
  botPostPerRound: 0,
  botCommentEverySec: 20,
  botCommentPerRound: 0,
  botLikeEverySec: 20,
  botLikePerRound: 0,
  botDmEverySec: 20,
  botDmPerRound: 0
};

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/* 人机频率：每秒次数，允许一位小数 */
function clampRate(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1000, Math.max(0, Math.round(n * 10) / 10));
}

/* 人机频率四类动作：新模型「每 N 秒 M 条」，旧模型「每秒 X 次」 */
const BOT_ACTIONS = ['Post', 'Comment', 'Like', 'Dm'];

function getSettings() {
  const out = Object.assign({}, DEFAULT_SETTINGS, { hiddenServices: [] });
  const seen = {};
  db.prepare('SELECT key, value FROM settings').all().forEach((row) => {
    const key = row.key;
    const raw = row.value;
    if (Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) seen[key] = true;
    if (key === 'uploadImageMB') out.uploadImageMB = clampInt(raw, 1, 500, DEFAULT_SETTINGS.uploadImageMB);
    else if (key === 'uploadVideoMB') out.uploadVideoMB = clampInt(raw, 1, 2048, DEFAULT_SETTINGS.uploadVideoMB);
    else if (key === 'mediaMaxPerPost') out.mediaMaxPerPost = clampInt(raw, 1, 9, DEFAULT_SETTINGS.mediaMaxPerPost);
    else if (key === 'autoBackupHours') out.autoBackupHours = clampInt(raw, 0, 168, DEFAULT_SETTINGS.autoBackupHours);
    else if (key === 'backupKeep') out.backupKeep = clampInt(raw, 1, 20, DEFAULT_SETTINGS.backupKeep);
    else if (key === 'botIntervalSec') out.botIntervalSec = clampInt(raw, 1, 3600, DEFAULT_SETTINGS.botIntervalSec);
    else if (key === 'botCommentPerSec') out.botCommentPerSec = clampRate(raw, DEFAULT_SETTINGS.botCommentPerSec);
    else if (key === 'botLikePerSec') out.botLikePerSec = clampRate(raw, DEFAULT_SETTINGS.botLikePerSec);
    else if (key === 'botPostPerSec') out.botPostPerSec = clampRate(raw, DEFAULT_SETTINGS.botPostPerSec);
    else if (key === 'botDmPerSec') out.botDmPerSec = clampRate(raw, DEFAULT_SETTINGS.botDmPerSec);
    else if (key === 'botPostEverySec') out.botPostEverySec = clampInt(raw, 1, 3600, DEFAULT_SETTINGS.botPostEverySec);
    else if (key === 'botPostPerRound') out.botPostPerRound = clampInt(raw, 0, 1000, DEFAULT_SETTINGS.botPostPerRound);
    else if (key === 'botCommentEverySec') out.botCommentEverySec = clampInt(raw, 1, 3600, DEFAULT_SETTINGS.botCommentEverySec);
    else if (key === 'botCommentPerRound') out.botCommentPerRound = clampInt(raw, 0, 1000, DEFAULT_SETTINGS.botCommentPerRound);
    else if (key === 'botLikeEverySec') out.botLikeEverySec = clampInt(raw, 1, 3600, DEFAULT_SETTINGS.botLikeEverySec);
    else if (key === 'botLikePerRound') out.botLikePerRound = clampInt(raw, 0, 1000, DEFAULT_SETTINGS.botLikePerRound);
    else if (key === 'botDmEverySec') out.botDmEverySec = clampInt(raw, 1, 3600, DEFAULT_SETTINGS.botDmEverySec);
    else if (key === 'botDmPerRound') out.botDmPerRound = clampInt(raw, 0, 1000, DEFAULT_SETTINGS.botDmPerRound);
    else if (key === 'allowPost') out.allowPost = String(raw) !== '0';
    else if (key === 'allowComment') out.allowComment = String(raw) !== '0';
    else if (key === 'hiddenServices') {
      try {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) out.hiddenServices = list.filter((k) => SERVICE_KEYS.includes(k));
      } catch (e) {
        out.hiddenServices = [];
      }
    }
  });
  /* 老库只有「每秒 X 次」：第一次读到新键时换算成「每 N 秒 M 条」，行为保持连续 */
  BOT_ACTIONS.forEach((name) => {
    const everyKey = 'bot' + name + 'EverySec';
    const roundKey = 'bot' + name + 'PerRound';
    if (seen[everyKey] || seen[roundKey]) return;
    const every = clampInt(out.botIntervalSec, 1, 3600, DEFAULT_SETTINGS.botIntervalSec);
    out[everyKey] = every;
    out[roundKey] = clampInt((Number(out['bot' + name + 'PerSec']) || 0) * every, 0, 1000, 0);
  });
  return out;
}

function saveSettings(patch, actor = 'admin') {
  patch = patch || {};
  const current = getSettings();
  const toBool = (v, fallback) => {
    if (v === undefined) return fallback;
    if (typeof v === 'string') return !(v === '' || v === '0' || v.toLowerCase() === 'false');
    return !!v;
  };
  const next = {
    uploadImageMB: patch.uploadImageMB === undefined ? current.uploadImageMB : clampInt(patch.uploadImageMB, 1, 500, current.uploadImageMB),
    uploadVideoMB: patch.uploadVideoMB === undefined ? current.uploadVideoMB : clampInt(patch.uploadVideoMB, 1, 2048, current.uploadVideoMB),
    mediaMaxPerPost: patch.mediaMaxPerPost === undefined ? current.mediaMaxPerPost : clampInt(patch.mediaMaxPerPost, 1, 9, current.mediaMaxPerPost),
    autoBackupHours: patch.autoBackupHours === undefined ? current.autoBackupHours : clampInt(patch.autoBackupHours, 0, 168, current.autoBackupHours),
    backupKeep: patch.backupKeep === undefined ? current.backupKeep : clampInt(patch.backupKeep, 1, 20, current.backupKeep),
    botIntervalSec: patch.botIntervalSec === undefined ? current.botIntervalSec : clampInt(patch.botIntervalSec, 1, 3600, current.botIntervalSec),
    allowPost: toBool(patch.allowPost, current.allowPost),
    allowComment: toBool(patch.allowComment, current.allowComment),
    botCommentPerSec: patch.botCommentPerSec === undefined ? current.botCommentPerSec : clampRate(patch.botCommentPerSec, current.botCommentPerSec),
    botLikePerSec: patch.botLikePerSec === undefined ? current.botLikePerSec : clampRate(patch.botLikePerSec, current.botLikePerSec),
    botPostPerSec: patch.botPostPerSec === undefined ? current.botPostPerSec : clampRate(patch.botPostPerSec, current.botPostPerSec),
    botDmPerSec: patch.botDmPerSec === undefined ? current.botDmPerSec : clampRate(patch.botDmPerSec, current.botDmPerSec),
    botPostEverySec: patch.botPostEverySec === undefined ? current.botPostEverySec : clampInt(patch.botPostEverySec, 1, 3600, current.botPostEverySec),
    botPostPerRound: patch.botPostPerRound === undefined ? current.botPostPerRound : clampInt(patch.botPostPerRound, 0, 1000, current.botPostPerRound),
    botCommentEverySec: patch.botCommentEverySec === undefined ? current.botCommentEverySec : clampInt(patch.botCommentEverySec, 1, 3600, current.botCommentEverySec),
    botCommentPerRound: patch.botCommentPerRound === undefined ? current.botCommentPerRound : clampInt(patch.botCommentPerRound, 0, 1000, current.botCommentPerRound),
    botLikeEverySec: patch.botLikeEverySec === undefined ? current.botLikeEverySec : clampInt(patch.botLikeEverySec, 1, 3600, current.botLikeEverySec),
    botLikePerRound: patch.botLikePerRound === undefined ? current.botLikePerRound : clampInt(patch.botLikePerRound, 0, 1000, current.botLikePerRound),
    botDmEverySec: patch.botDmEverySec === undefined ? current.botDmEverySec : clampInt(patch.botDmEverySec, 1, 3600, current.botDmEverySec),
    botDmPerRound: patch.botDmPerRound === undefined ? current.botDmPerRound : clampInt(patch.botDmPerRound, 0, 1000, current.botDmPerRound),
    hiddenServices: patch.hiddenServices === undefined
      ? current.hiddenServices
      : (Array.isArray(patch.hiddenServices) ? patch.hiddenServices : []).filter((k) => SERVICE_KEYS.includes(k))
  };
  /* 新旧字段互为镜像：界面用「每 N 秒 M 条」，旧版 App 仍按「每秒 X 次」工作 */
  BOT_ACTIONS.forEach((name) => {
    const everyKey = 'bot' + name + 'EverySec';
    const roundKey = 'bot' + name + 'PerRound';
    const rateKey = 'bot' + name + 'PerSec';
    const patchHasNew = patch[everyKey] !== undefined || patch[roundKey] !== undefined;
    if (!patchHasNew && patch[rateKey] !== undefined) {
      /* 只有老界面提交了每秒速率：换算成每 N 秒 M 条 */
      const rate = clampRate(patch[rateKey], current[rateKey]);
      next[roundKey] = clampInt(rate * next[everyKey], 0, 1000, next[roundKey]);
    }
    next[rateKey] = clampRate((Number(next[roundKey]) || 0) / Math.max(1, Number(next[everyKey]) || 1), 0);
  });
  const put = db.prepare(
    'INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  put.run('uploadImageMB', String(next.uploadImageMB));
  put.run('uploadVideoMB', String(next.uploadVideoMB));
  put.run('mediaMaxPerPost', String(next.mediaMaxPerPost));
  put.run('autoBackupHours', String(next.autoBackupHours));
  put.run('backupKeep', String(next.backupKeep));
  put.run('botIntervalSec', String(next.botIntervalSec));
  put.run('allowPost', next.allowPost ? '1' : '0');
  put.run('allowComment', next.allowComment ? '1' : '0');
  put.run('botCommentPerSec', String(next.botCommentPerSec));
  put.run('botLikePerSec', String(next.botLikePerSec));
  put.run('botPostPerSec', String(next.botPostPerSec));
  put.run('botDmPerSec', String(next.botDmPerSec));
  BOT_ACTIONS.forEach((name) => {
    put.run('bot' + name + 'EverySec', String(next['bot' + name + 'EverySec']));
    put.run('bot' + name + 'PerRound', String(next['bot' + name + 'PerRound']));
  });
  put.run('hiddenServices', JSON.stringify(next.hiddenServices));
  /* 记修改记录：只记真正变了的字段，避免每次保存都刷一堆无意义条目 */
  const changed = [];
  Object.keys(next).forEach((k) => {
    const before = JSON.stringify(current[k]);
    const after = JSON.stringify(next[k]);
    if (before !== after) changed.push({ field: k, oldValue: before, newValue: after });
  });
  if (changed.length) {
    changed.forEach((c) => addConfigHistory({
      scope: 'settings', action: 'update', field: c.field,
      oldValue: c.oldValue, newValue: c.newValue, note: '设置项变更', actor
    }));
  }
  return getSettings();
}

function setMuted(userId, muted) {
  db.prepare('UPDATE users SET muted = ? WHERE id = ?').run(muted ? 1 : 0, userId);
}

function setPassword(userId, password) {
  if (String(password || '').length < 6) throw new Error('密码至少 6 位');
  const { salt, hash } = hashPassword(password);
  db.prepare('UPDATE users SET pass_hash = ?, salt = ? WHERE id = ?').run(hash, salt, userId);
}

function listAdmins() {
  return db
    .prepare('SELECT * FROM users WHERE is_admin = 1 ORDER BY id')
    .all()
    .map((u) => publicUser(u));
}

function createAdmin({ username, password, nickname } = {}) {
  const name = String(username || '').trim().toLowerCase();
  if (!/^[a-z0-9_]{2,24}$/.test(name)) throw new Error('账号需为 2-24 位字母、数字或下划线');
  const existing = findUserByName(name);
  if (existing) {
    if (existing.is_admin) throw new Error('该账号已经是管理员');
    if (existing.is_guest) throw new Error('游客账号不能设为管理员');
    db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(existing.id);
    if (String(password || '').length >= 6) setPassword(existing.id, password);
    return publicUser(findUserByName(name));
  }
  if (String(password || '').length < 6) throw new Error('密码至少 6 位');
  return publicUser(createUser({ username: name, nickname, password, isAdmin: true }));
}

function demoteAdmin(userId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) throw new Error('用户不存在');
  if (!user.is_admin) return false;
  const total = db.prepare('SELECT COUNT(*) AS n FROM users WHERE is_admin = 1').get().n;
  if (total <= 1) throw new Error('至少要保留一个管理员');
  db.prepare('UPDATE users SET is_admin = 0 WHERE id = ?').run(userId);
  return true;
}

function deleteUser(userId) {
  const posts = db.prepare('SELECT id FROM posts WHERE user_id = ?').all(userId);
  posts.forEach((p) => deletePost(p.id));
  db.prepare('UPDATE comments SET reply_to = NULL WHERE reply_to IN (SELECT id FROM comments WHERE user_id = ?)').run(userId);
  db.prepare('DELETE FROM comments WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM likes WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM reposts WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM follows WHERE follower_id = ? OR followed_id = ?').run(userId, userId);
  db.prepare('DELETE FROM direct_messages WHERE sender_id = ? OR recipient_id = ?').run(userId, userId);
  db.prepare('DELETE FROM notifications WHERE user_id = ? OR actor_id = ?').run(userId, userId);
  const files = db.prepare('SELECT id FROM media WHERE user_id = ?').all(userId);
  db.prepare('DELETE FROM media WHERE user_id = ?').run(userId);
  /* 数据库里的记录删掉后，磁盘上的上传文件也要清掉，否则永远留在 media 目录里 */
  files.forEach((f) => {
    try { fs.unlinkSync(path.join(MEDIA_DIR, f.id)); } catch (e) { /* 文件可能已不存在 */ }
  });
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}

/* 批量删除账号：跳过管理员和当前操作人，其余逐个按单账号规则清理 */
function deleteUsers(ids, skipId = 0) {
  const result = { deleted: 0, skipped: 0, deletedIds: [] };
  const seen = {};
  (Array.isArray(ids) ? ids : []).forEach((raw) => {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0 || seen[id]) return;
    seen[id] = true;
    if (id === Number(skipId)) { result.skipped += 1; return; }
    const u = db.prepare('SELECT id, is_admin FROM users WHERE id = ?').get(id);
    if (!u || u.is_admin) { result.skipped += 1; return; }
    deleteUser(id);
    result.deleted += 1;
    result.deletedIds.push(id);
  });
  return result;
}

/* 修改自己的资料：账号 + 昵称（昵称与账号全站唯一） */
function updateProfile(userId, { username, nickname } = {}) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) throw new Error('用户不存在');
  if (user.is_guest) throw new Error('游客账号不支持修改');
  if (BUILTIN_USERNAMES.indexOf(String(user.username).toLowerCase()) >= 0) {
    throw new Error('内置账号不支持修改');
  }
  let nextName = user.username;
  if (username !== undefined) {
    nextName = String(username || '').trim().toLowerCase();
    if (nextName !== user.username) {
      if (!/^[a-z0-9_]{2,24}$/.test(nextName)) {
        throw new Error('账号需为 2-24 位字母、数字或下划线');
      }
      const info = usernameChangeInfo(user);
      if (!info.canChange) {
        const day = info.nextAt ? String(info.nextAt).slice(0, 10) : '';
        throw new Error(day ? '账号每月只能修改一次，下次可修改时间：' + day : (info.reason || '暂时不能修改账号'));
      }
      const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(nextName);
      if (exists && exists.id !== userId) throw new Error('该账号已被注册');
      db.prepare('UPDATE users SET username = ?, username_changed_at = ? WHERE id = ?').run(nextName, now(), userId);
    }
  }
  if (nickname !== undefined) {
    const nick = assertNickname(nickname, userId);
    if (nick !== user.nickname) db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run(nick, userId);
  }
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

/* ---------------- 整站备份 / 清空 / 恢复 ---------------- */

/* 一份备份 = 一个目录：data/backup/<年月日-时分秒>-<类型>/
   目录里是 u.db（VACUUM INTO 出来的完整数据库）、media/（与运行目录硬链接，几乎不占额外空间，
   原文件被删也不影响备份）、meta.json（时间、类型、各项计数、媒体文件数、总字节）。
   早期版本留下的 snapshot.db + meta.json 仍能识别、能恢复。 */
const BACKUP_ROOT = path.join(DATA_DIR, 'backup');
const BACKUP_DB_NAME = 'u.db';
const BACKUP_LEGACY_DB = path.join(BACKUP_ROOT, 'snapshot.db');
const BACKUP_KEEP = 5;
const BACKUP_AUTO_HOURS = 24;

function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}

function backupStamp(date) {
  const d = date || new Date();
  return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '-' +
    pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
}

/* 只接受纯名字，挡住 ../ 目录穿越 */
function safeBackupName(name) {
  const raw = String(name || '').trim();
  if (!raw || raw.indexOf('/') >= 0 || raw.indexOf('\\') >= 0 || raw.indexOf('..') >= 0 || raw !== path.basename(raw)) {
    const err = new Error('备份名称不合法');
    err.code = 'EBADNAME';
    throw err;
  }
  return raw;
}

function listBackupDirs() {
  const out = [];
  try {
    fs.readdirSync(BACKUP_ROOT).forEach((name) => {
      try {
        if (fs.statSync(path.join(BACKUP_ROOT, name)).isDirectory()) out.push(name);
      } catch (e) {
        /* 单个目录读不到就跳过 */
      }
    });
  } catch (e) {
    /* 备份目录还不存在 */
  }
  out.sort();
  return out;
}

/* 目录总大小与文件数（含子目录，备份里就是 media/） */
function dirUsage(dir) {
  let bytes = 0;
  let files = 0;
  try {
    fs.readdirSync(dir).forEach((f) => {
      const p = path.join(dir, f);
      let st = null;
      try {
        st = fs.statSync(p);
      } catch (e) {
        return;
      }
      if (st.isDirectory()) {
        const sub = dirUsage(p);
        bytes += sub.bytes;
        files += sub.files;
      } else {
        bytes += st.size;
        files += 1;
      }
    });
  } catch (e) {
    /* 目录不存在 */
  }
  return { bytes, files };
}

function readBackupMeta(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8')) || {};
  } catch (e) {
    return {};
  }
}

/* 单个备份目录的完整描述：后台「最近备份」与列表都用这个结构 */
function backupItem(name) {
  const dir = path.join(BACKUP_ROOT, name);
  const meta = readBackupMeta(dir);
  const usage = dirUsage(dir);
  let mtime = now();
  try {
    mtime = fs.statSync(path.join(dir, BACKUP_DB_NAME)).mtime.toISOString();
  } catch (e) {
    /* 用当前时间兜底 */
  }
  return {
    name,
    path: dir,
    size: usage.bytes,
    files: usage.files,
    mediaFiles: meta.mediaFiles || 0,
    counts: meta.counts || null,
    createdAt: meta.createdAt || mtime,
    mtime,
    reason: meta.reason || 'auto',
    kind: meta.reason === 'manual' ? 'manual' : 'auto',
    legacy: false
  };
}

function latestBackupItem() {
  const dirs = listBackupDirs();
  return dirs.length ? backupItem(dirs[dirs.length - 1]) : null;
}

/* 只保留最近 keep 份（目录名以时间戳开头，字典序即时间序） */
function pruneBackups(keep) {
  const limit = clampInt(keep, 1, 50, BACKUP_KEEP);
  const dirs = listBackupDirs();
  while (dirs.length > limit) {
    const old = dirs.shift();
    try {
      fs.rmSync(path.join(BACKUP_ROOT, old), { recursive: true, force: true });
    } catch (e) {
      /* 目录被占用就下次再清 */
    }
  }
}

const DATA_TABLES = [
  'users',
  'sessions',
  'posts',
  'media',
  'comments',
  'likes',
  'follows',
  'reposts',
  'direct_messages',
  'notifications'
];

function dataCounts() {
  const out = {};
  DATA_TABLES.forEach((t) => {
    out[t] = db.prepare('SELECT COUNT(*) AS n FROM ' + t).get().n;
  });
  return out;
}

/* 媒体文件用硬链接进备份：同一分区内瞬间完成、不额外占空间，删除原文件也不影响备份内容；
   跨分区或硬链接失败时才退回真实复制。 */
function copyMediaTo(target) {
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  let linked = 0;
  let copied = 0;
  fs.readdirSync(MEDIA_DIR).forEach((f) => {
    const src = path.join(MEDIA_DIR, f);
    const dst = path.join(target, f);
    try {
      if (!fs.statSync(src).isFile()) return;
      try {
        fs.linkSync(src, dst);
        linked += 1;
      } catch (e) {
        fs.copyFileSync(src, dst);
        copied += 1;
      }
    } catch (e) {
      /* 单个文件失败不阻塞整体备份 */
    }
  });
  return { linked, copied };
}

/* 生成一份完整备份（数据库 + 图片视频），默认保留最近 5 份 */
function createBackup(reason) {
  fs.mkdirSync(BACKUP_ROOT, { recursive: true });
  const kind = String(reason || 'manual');
  const base = backupStamp() + '-' + kind;
  let name = base;
  let n = 2;
  while (fs.existsSync(path.join(BACKUP_ROOT, name))) {
    name = base + '-' + n;
    n += 1;
  }
  const dir = path.join(BACKUP_ROOT, name);
  fs.mkdirSync(dir, { recursive: true });
  const dbFile = path.join(dir, BACKUP_DB_NAME);
  db.exec("VACUUM INTO '" + dbFile.replace(/'/g, "''") + "'");
  const media = copyMediaTo(path.join(dir, 'media'));
  const counts = dataCounts();
  const usage = dirUsage(dir);
  const meta = {
    name,
    createdAt: now(),
    reason: kind,
    counts,
    mediaFiles: media.linked + media.copied,
    bytes: usage.bytes
  };
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
  pruneBackups(clampInt(getSettings().backupKeep, 1, 20, BACKUP_KEEP));
  addConfigHistory({
    scope: 'data', action: 'backup', field: 'snapshot',
    oldValue: '', newValue: JSON.stringify(counts),
    note: '生成备份 ' + name + '（' + (counts.posts || 0) + ' 帖子 · ' + meta.mediaFiles + ' 个媒体文件 · ' + usage.bytes + ' 字节）'
  });
  return meta;
}

/* 自动备份：距上一份超过 autoBackupHours 小时就再存一份；autoBackupHours=0 即关闭 */
function autoBackupTick() {
  try {
    const settings = getSettings();
    pruneBackups(clampInt(settings.backupKeep, 1, 20, BACKUP_KEEP));
    const hours = clampInt(settings.autoBackupHours, 0, 168, BACKUP_AUTO_HOURS);
    if (!hours) return { skipped: 'off' };
    const latest = latestBackupItem();
    if (latest && latest.createdAt) {
      const age = (Date.now() - new Date(latest.createdAt).getTime()) / 3600000;
      if (age >= 0 && age < hours) return { skipped: 'fresh', age };
    }
    const meta = createBackup('auto');
    return { created: meta.name, counts: meta.counts };
  } catch (e) {
    console.error('[自动备份失败] ' + (e && e.message ? e.message : e));
    return { error: e.message };
  }
}

/* 最近一份备份的信息；没有目录备份时退回旧版 snapshot.db */
function backupInfo() {
  const latest = latestBackupItem();
  if (latest) {
    return {
      exists: true,
      name: latest.name,
      createdAt: latest.createdAt,
      counts: latest.counts,
      bytes: latest.size,
      mediaFiles: latest.mediaFiles,
      reason: latest.reason,
      legacy: false
    };
  }
  if (fs.existsSync(BACKUP_LEGACY_DB)) {
    const meta = readBackupMeta(BACKUP_ROOT);
    let bytes = 0;
    try {
      bytes = fs.statSync(BACKUP_LEGACY_DB).size;
    } catch (e) {
      /* 文件读不到就按 0 展示 */
    }
    return {
      exists: true,
      name: 'snapshot.db',
      createdAt: meta.createdAt || null,
      counts: meta.counts || null,
      bytes,
      mediaFiles: 0,
      reason: 'legacy',
      legacy: true
    };
  }
  return { exists: false };
}

const BACKUP_EXTS = ['.db', '.zip', '.json'];

/* 备份列表：每个目录备份一份（含数据库 + 图片视频），旧版的 snapshot.db 之类的单文件也列出来 */
function listBackups() {
  const items = [];
  try {
    fs.readdirSync(BACKUP_ROOT).forEach((name) => {
      const full = path.join(BACKUP_ROOT, name);
      let st = null;
      try {
        st = fs.statSync(full);
      } catch (e) {
        return;
      }
      if (st.isDirectory()) {
        items.push(backupItem(name));
        return;
      }
      const ext = path.extname(name).toLowerCase();
      if (!BACKUP_EXTS.includes(ext)) return;
      /* 旧版 meta.json 只是元信息，不是数据快照，不在列表里占位 */
      if (ext === '.json') return;
      items.push({
        name,
        size: st.size,
        mtime: st.mtime.toISOString(),
        createdAt: st.mtime.toISOString(),
        kind: /snapshot/i.test(name) ? 'auto' : 'manual',
        mediaFiles: 0,
        counts: null,
        legacy: true
      });
    });
  } catch (e) {
    /* 备份目录还不存在时返回空列表 */
  }
  items.sort((a, b) => String(b.mtime || '').localeCompare(String(a.mtime || '')));
  return items;
}

/* 删除单个备份文件，只允许纯文件名，避免目录穿越 */
/* 删除一份备份（目录备份整目录删掉，旧版单文件按文件删），只接受纯名字 */
function deleteBackup(name, { actor = '', ip = '' } = {}) {
  const raw = safeBackupName(name);
  const target = path.join(BACKUP_ROOT, raw);
  let st = null;
  try {
    st = fs.statSync(target);
  } catch (e) {
    st = null;
  }
  if (!st) {
    const err = new Error('备份不存在');
    err.code = 'ENOENT';
    throw err;
  }
  if (!st.isDirectory() && !BACKUP_EXTS.includes(path.extname(raw).toLowerCase())) {
    const err = new Error('备份不存在');
    err.code = 'ENOENT';
    throw err;
  }
  fs.rmSync(target, { recursive: true, force: true });
  addConfigHistory({
    scope: 'data', action: 'backup-delete', field: 'backup',
    oldValue: raw, newValue: '', note: '删除备份 ' + raw, actor, ip
  });
  return { name: raw };
}

/* 清空修改记录；清除动作本身再留一条记录，便于追溯 */
function clearConfigHistory(scope, { actor = '', ip = '' } = {}) {
  const key = String(scope || '').trim();
  let deleted = 0;
  if (key) {
    deleted = db.prepare('DELETE FROM config_history WHERE scope = ?').run(key).changes;
  } else {
    deleted = db.prepare('DELETE FROM config_history').run().changes;
  }
  addConfigHistory({
    scope: 'data', action: 'clear', field: 'config_history',
    oldValue: key || 'all', newValue: String(deleted),
    note: '清除修改记录 ' + (key ? '范围 ' + key : '全部范围') + '，共 ' + deleted + ' 条',
    actor, ip
  });
  return { deleted };
}

function wipeMediaDir() {
  fs.readdirSync(MEDIA_DIR).forEach((f) => {
    try {
      fs.rmSync(path.join(MEDIA_DIR, f), { recursive: true, force: true });
    } catch (e) {
      /* 文件被占用时跳过 */
    }
  });
}

/* 清空 App 全部数据：先自动备份，再删除所有内容与普通账号，仅保留管理员账号 */
function clearAppData() {
  const backup = createBackup('auto-clear');
  const before = dataCounts();
  db.exec('BEGIN');
  try {
    ['notifications', 'direct_messages', 'follows', 'reposts', 'likes', 'comments', 'posts', 'media'].forEach(
      (t) => db.prepare('DELETE FROM ' + t).run()
    );
    db.prepare('DELETE FROM sessions WHERE user_id NOT IN (SELECT id FROM users WHERE is_admin = 1)').run();
    db.prepare('DELETE FROM users WHERE is_admin = 0').run();
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  wipeMediaDir();
  addConfigHistory({
    scope: 'data', action: 'clear', field: 'ALL',
    oldValue: JSON.stringify(before), newValue: '{}',
    note: '清空全部数据（已自动备份到 ' + BACKUP_ROOT + '）'
  });
  return { backup, counts: dataCounts() };
}

/* 找到要恢复的备份：给了名字就用那份，没给就用最近一份 */
function resolveBackupTarget(name) {
  if (!name) {
    const latest = latestBackupItem();
    if (latest) {
      return { name: latest.name, dbFile: path.join(latest.path, BACKUP_DB_NAME), mediaDir: path.join(latest.path, 'media') };
    }
    if (fs.existsSync(BACKUP_LEGACY_DB)) {
      return { name: 'snapshot.db', dbFile: BACKUP_LEGACY_DB, mediaDir: path.join(BACKUP_ROOT, 'media') };
    }
    throw new Error('暂无可恢复的备份');
  }
  const raw = safeBackupName(name);
  const target = path.join(BACKUP_ROOT, raw);
  let st = null;
  try {
    st = fs.statSync(target);
  } catch (e) {
    st = null;
  }
  if (!st) {
    const err = new Error('备份不存在');
    err.code = 'ENOENT';
    throw err;
  }
  if (st.isDirectory()) {
    return { name: raw, dbFile: path.join(target, BACKUP_DB_NAME), mediaDir: path.join(target, 'media') };
  }
  return { name: raw, dbFile: target, mediaDir: path.join(BACKUP_ROOT, 'media') };
}

/* 从指定备份（默认最近一份）恢复：数据库与图片视频一并还原 */
function restoreAppData(name) {
  const target = resolveBackupTarget(name);
  if (!fs.existsSync(target.dbFile)) throw new Error('这个备份里没有数据库文件');
  const src = new DatabaseSync(target.dbFile, { readOnly: true });
  const dump = {};
  try {
    DATA_TABLES.forEach((t) => {
      const cols = src.prepare('PRAGMA table_info(' + t + ')').all().map((c) => c.name);
      dump[t] = { cols, rows: src.prepare('SELECT * FROM ' + t).all() };
    });
  } finally {
    src.close();
  }

  db.exec('BEGIN');
  try {
    ['notifications', 'direct_messages', 'follows', 'reposts', 'likes', 'comments', 'media', 'posts', 'sessions', 'users'].forEach(
      (t) => db.prepare('DELETE FROM ' + t).run()
    );
    DATA_TABLES.forEach((t) => {
      const { cols, rows } = dump[t];
      if (!cols.length || !rows.length) return;
      const sql =
        'INSERT INTO ' + t + ' (' + cols.join(',') + ') VALUES (' + cols.map(() => '?').join(',') + ')';
      const st = db.prepare(sql);
      rows.forEach((r) => st.run(...cols.map((c) => r[c])));
    });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  wipeMediaDir();
  let restored = 0;
  if (fs.existsSync(target.mediaDir)) {
    fs.readdirSync(target.mediaDir).forEach((f) => {
      const from = path.join(target.mediaDir, f);
      const to = path.join(MEDIA_DIR, f);
      try {
        if (!fs.statSync(from).isFile()) return;
        try {
          fs.linkSync(from, to);
        } catch (e) {
          fs.copyFileSync(from, to);
        }
        restored += 1;
      } catch (e) {
        /* 单个媒体文件恢复失败不阻塞整体恢复 */
      }
    });
  }
  addConfigHistory({
    scope: 'data', action: 'restore', field: target.name,
    oldValue: '', newValue: JSON.stringify(dataCounts()),
    note: '从备份 ' + target.name + ' 恢复（' + restored + ' 个媒体文件）'
  });
  return { name: target.name, mediaFiles: restored, counts: dataCounts(), backup: backupInfo() };
}

/* ---------------- 操作日志（登录 / 注册 / 发帖 / 评论 / 密码错误） ---------------- */

function addLog({ type, userId = null, username = '', ip = '', detail = '' } = {}) {
  try {
    db.prepare(
      'INSERT INTO logs(type, user_id, username, ip, detail, created_at) VALUES(?,?,?,?,?,?)'
    ).run(
      String(type || 'other').slice(0, 32),
      userId || null,
      String(username || '').slice(0, 64),
      String(ip || '').slice(0, 64),
      String(detail || '').slice(0, 500),
      now()
    );
  } catch (e) {
    /* 日志写入失败不影响主流程 */
  }
}

function listLogs({ type = '', q = '', offset = 0, limit = 50 } = {}) {
  const where = [];
  const params = [];
  if (type && type !== 'all') {
    where.push('type = ?');
    params.push(String(type));
  }
  if (q) {
    where.push('(username LIKE ? OR ip LIKE ? OR detail LIKE ?)');
    const like = '%' + String(q) + '%';
    params.push(like, like, like);
  }
  const clause = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const total = db.prepare('SELECT COUNT(*) AS n FROM logs' + clause).get(...params).n;
  const rows = db
    .prepare(
      'SELECT l.*, COALESCE((SELECT u.is_admin FROM users u WHERE u.id = l.user_id), 0) AS user_is_admin' +
      ' FROM logs l' + clause + ' ORDER BY l.id DESC LIMIT ? OFFSET ?'
    )
    .all(...params, Math.min(Math.max(Number(limit) || 50, 1), 200), Math.max(Number(offset) || 0, 0));
  return {
    total,
    logs: rows.map((r) => ({
      id: r.id,
      type: r.type,
      userId: r.user_id,
      username: r.username,
      ip: r.ip,
      detail: r.detail,
      isAdmin: !!r.user_is_admin,
      createdAt: r.created_at
    }))
  };
}

function clearLogs() {
  db.prepare('DELETE FROM logs').run();
}

/* ---------------- 修改记录 / 数据目录（上传目录） ---------------- */

function addConfigHistory({ scope = 'app', action = 'update', field = '', oldValue = '', newValue = '', note = '', actor = '', ip = '' } = {}) {
  try {
    db.prepare(
      'INSERT INTO config_history(scope, action, field, old_value, new_value, note, actor, ip, created_at)' +
      ' VALUES(?,?,?,?,?,?,?,?,?)'
    ).run(
      String(scope).slice(0, 32),
      String(action).slice(0, 32),
      String(field).slice(0, 64),
      String(oldValue === null || oldValue === undefined ? '' : oldValue).slice(0, 1000),
      String(newValue === null || newValue === undefined ? '' : newValue).slice(0, 1000),
      String(note || '').slice(0, 500),
      String(actor || '').slice(0, 64),
      String(ip || '').slice(0, 64),
      now()
    );
  } catch (e) {
    console.error('[config-history] 写入失败：', e.message);
  }
}

function listConfigHistory({ scope = '', offset = 0, limit = 100 } = {}) {
  const where = scope && scope !== 'all' ? ' WHERE scope = ?' : '';
  const params = where ? [String(scope)] : [];
  const total = db.prepare('SELECT COUNT(*) AS n FROM config_history' + where).get(...params).n;
  const rows = db.prepare(
    'SELECT * FROM config_history' + where + ' ORDER BY id DESC LIMIT ? OFFSET ?'
  ).all(...params, Math.min(Math.max(Number(limit) || 100, 1), 500), Math.max(Number(offset) || 0, 0));
  return {
    total,
    history: rows.map((r) => ({
      id: r.id,
      scope: r.scope,
      action: r.action,
      field: r.field,
      oldValue: r.old_value,
      newValue: r.new_value,
      note: r.note,
      actor: r.actor,
      ip: r.ip,
      createdAt: r.created_at
    }))
  };
}

function dataDirInfo() {
  let dbBytes = 0;
  try { dbBytes = fs.statSync(path.join(DATA_DIR, 'u.db')).size; } catch (e) { /* 刚建库时可能还没文件 */ }
  return {
    dir: DATA_DIR,
    mediaDir: MEDIA_DIR,
    backupDir: BACKUP_ROOT,
    configFile: DATA_DIR_FILE,
    defaultDir: DEFAULT_DATA_DIR,
    source: DATA_INFO.source,          // env | config | default
    envOverride: !!process.env.U_DATA_DIR,
    configUpdatedAt: DATA_INFO.updatedAt || null,
    configUpdatedBy: DATA_INFO.by || null,
    dbBytes,
    exists: fs.existsSync(DATA_DIR),
    writable: (() => {
      try {
        const probe = path.join(DATA_DIR, '.write-probe');
        fs.writeFileSync(probe, 'ok');
        fs.unlinkSync(probe);
        return true;
      } catch (e) {
        return false;
      }
    })()
  };
}

/* 改数据目录：只写配置文件 + 记历史，不热迁移（热切换要重开 SQLite，容易把 WAL 搞坏）。
   返回 needRestart=true，管理台提示重启，重启后新目录生效。 */
function setDataDir(dir, { actor = '', ip = '', note = '' } = {}) {
  const target = String(dir || '').trim();
  if (!target) throw new Error('数据目录不能为空');
  const abs = path.resolve(target);
  if (abs.length < 4) throw new Error('数据目录路径太短，拒绝写入');
  if (process.env.U_DATA_DIR) throw new Error('服务正被环境变量 U_DATA_DIR 强制指定，改配置文件不生效；请先去掉该环境变量');

  /* 目标目录必须能建、能写，否则改完重启就起不来 */
  try {
    fs.mkdirSync(path.join(abs, 'media'), { recursive: true });
    const probe = path.join(abs, '.write-probe');
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
  } catch (e) {
    throw new Error('目标目录不可写：' + e.message);
  }

  const oldDir = DATA_DIR;
  if (abs === oldDir) return { dir: abs, needRestart: false, changed: false };

  /* 老目录里若有数据，先记一笔，方便回滚时对照 */
  let oldDbBytes = 0;
  try { oldDbBytes = fs.statSync(path.join(oldDir, 'u.db')).size; } catch (e) { /* 没有就算了 */ }
  let targetHasDb = fs.existsSync(path.join(abs, 'u.db'));

  const payload = {
    dir: abs,
    updatedAt: now(),
    by: actor || 'admin',
    previousDir: oldDir,
    note: String(note || '').slice(0, 300)
  };
  fs.mkdirSync(path.dirname(DATA_DIR_FILE), { recursive: true });
  fs.writeFileSync(DATA_DIR_FILE, JSON.stringify(payload, null, 2), 'utf8');

  addConfigHistory({
    scope: 'data', action: 'change-dir', field: 'DATA_DIR',
    oldValue: oldDir, newValue: abs,
    note: (note ? note + '；' : '') + '原目录库大小 ' + oldDbBytes + ' 字节，目标目录' + (targetHasDb ? '已有 u.db（将直接使用）' : '无 u.db（首次启动会新建空库）'),
    actor, ip
  });

  return { dir: abs, previousDir: oldDir, needRestart: true, changed: true, targetHasDb, oldDbBytes };
}

function stats() {
  const one = (sql, ...p) => db.prepare(sql).get(...p).n;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return {
    users: one('SELECT COUNT(*) AS n FROM users'),
    posts: one('SELECT COUNT(*) AS n FROM posts'),
    comments: one('SELECT COUNT(*) AS n FROM comments'),
    likes: one('SELECT COUNT(*) AS n FROM likes'),
    media: one('SELECT COUNT(*) AS n FROM media'),
    mediaBytes: one('SELECT COALESCE(SUM(size), 0) AS n FROM media'),
    mediaImageBytes: one("SELECT COALESCE(SUM(size), 0) AS n FROM media WHERE mime LIKE 'image/%'"),
    mediaVideoBytes: one("SELECT COALESCE(SUM(size), 0) AS n FROM media WHERE mime LIKE 'video/%'"),
    todayPosts: one('SELECT COUNT(*) AS n FROM posts WHERE created_at >= ?', today.toISOString()),
    todayUsers: one('SELECT COUNT(*) AS n FROM users WHERE created_at >= ?', today.toISOString()),
    online: one('SELECT COUNT(DISTINCT user_id) AS n FROM sessions WHERE expires_at > ?', now()),
    banned: one('SELECT COUNT(*) AS n FROM users WHERE banned = 1'),
    muted: one('SELECT COUNT(*) AS n FROM users WHERE muted = 1'),
    guests: one('SELECT COUNT(*) AS n FROM users WHERE is_guest = 1')
  };
}

module.exports = {
  DATA_DIR,
  MEDIA_DIR,
  DATA_INFO,
  DATA_DIR_FILE,
  DEFAULT_DATA_DIR,
  db,
  now,
  createUser,
  createGuestUser,
  ensureBotUser,
  contentRole,
  recordMedia,
  setMediaPoster,
  updatePostMeta,
  BOT_MAX,
  botDmTargets,
  findUserByName,
  verifyPassword,
  publicUser,
  ensureAdmin,
  createSession,
  sessionUser,
  deleteSession,
  listPosts,
  getPost,
  createPost,
  deletePost,
  bumpPostView,
  userCounts,
  userFollowList,
  linkFollow,
  findOfficialUser,
  welcomeNewUser,
  toggleLike,
  toggleRepost,
  addComment,
  listComments,
  userProfile,
  toggleFollow,
  userActivity,
  search,
  listConversations,
  listMessages,
  sendMessage,
  listNotifications,
  markNotificationsRead,
  adminUsers,
  adminUsersTotal,
  adminPosts,
  adminPostsTotal,
  adminComments,
  adminCommentsTotal,
  adminMedia,
  adminMediaTotal,
  adminRoleWhere,
  ADMIN_ROLE_FILTERS,
  deleteComment,
  deleteMedia,
  deleteManyPosts,
  deleteManyComments,
  deleteManyMedia,
  deleteAllPosts,
  deleteAllComments,
  deleteAllMedia,
  setBanned,
  setMuted,
  setPassword,
  listAdmins,
  createAdmin,
  demoteAdmin,
  getSettings,
  saveSettings,
  SERVICE_KEYS,
  DEFAULT_SETTINGS,
  deleteUser,
  deleteUsers,
  updateProfile,
  usernameChangeInfo,
  createBackup,
  autoBackupTick,
  backupInfo,
  listBackups,
  deleteBackup,
  clearConfigHistory,
  clearAppData,
  restoreAppData,
  addLog,
  listLogs,
  clearLogs,
  addConfigHistory,
  listConfigHistory,
  dataDirInfo,
  setDataDir,
  stats
};
