'use strict';

const nodeMajor = Number(process.versions.node.split('.')[0]);
const nodeMinor = Number(process.versions.node.split('.')[1]);
if (nodeMajor < 22 || (nodeMajor === 22 && nodeMinor < 5)) {
  console.error('\n[启动失败] 需要 Node.js 22.5 或更高版本（当前 v' + process.versions.node + '）。');
  console.error('原因：数据库使用 Node 内置的 node:sqlite。');
  console.error('请到 https://nodejs.org 安装最新 LTS 后重试。\n');
  process.exit(1);
}

const http = require('node:http');
const dgram = require('node:dgram');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const {
  DATA_DIR,
  MEDIA_DIR,
  DATA_INFO,
  DATA_DIR_FILE,
  db,
  createUser,
  createGuestUser,
  ensureBotUser,
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
  welcomeNewUser,
  toggleLike,
  toggleRepost,
  addComment,
  listComments,
  userProfile,
  toggleFollow,
  userFollowList,
  userActivity,
  search,
  listConversations,
  listMessages,
  sendMessage,
  listNotifications,
  markNotificationsRead,
  createBackup,
  autoBackupTick,
  backupInfo,
  listBackups,
  deleteBackup,
  clearConfigHistory,
  clearAppData,
  restoreAppData,
  adminUsers,
  adminUsersTotal,
  adminPosts,
  adminPostsTotal,
  adminComments,
  adminCommentsTotal,
  adminMedia,
  adminMediaTotal,
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
  deleteUser,
  deleteUsers,
  updateProfile,
  addLog,
  listLogs,
  clearLogs,
  addConfigHistory,
  listConfigHistory,
  dataDirInfo,
  setDataDir,
  stats
} = require('./db');

const PORT = Number(process.env.PORT || 8787);
let listenPort = PORT;
const HOST = process.env.HOST || '0.0.0.0';
/* UDP 发现端口：App 广播「U?」，谁在这个端口应答就是 U 服务器 */
const DISCOVER_PORT = Number(process.env.U_DISCOVER_PORT || 8788);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
/* 上传大小不再写死：由管理台的「上传限制」实时决定（见 /api/admin/settings） */
const startedAt = Date.now();
/* 浏览量去重：同一账号/IP 对同一帖子 30 分钟内只算一次 */
const viewTouch = new Map();
const VIEW_TTL = 30 * 60 * 1000;

ensureAdmin();

/* ---------------- 基础工具 ---------------- */

function baseHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Filename');
  /* 允许局域网 / file:// 页面访问本机服务（Chrome 私有网络访问预检） */
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function json(res, code, data) {
  const body = Buffer.from(JSON.stringify(data));
  if (res.writableEnded || res.destroyed) return;
  try {
    baseHeaders(res);
    res.writeHead(code, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': body.length,
      'Cache-Control': 'no-store'
    });
    res.end(body);
  } catch (e) {
    /* 连接已被客户端关闭，忽略 */
  }
}

function text(res, code, body, type = 'text/plain; charset=utf-8') {
  const buf = Buffer.from(body);
  if (res.writableEnded || res.destroyed) return;
  try {
    baseHeaders(res);
    res.writeHead(code, { 'Content-Type': type, 'Content-Length': buf.length });
    res.end(buf);
  } catch (e) {
    /* 连接已被客户端关闭，忽略 */
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 2 * 1024 * 1024) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (e) {
        reject(new Error('JSON 格式错误'));
      }
    });
    req.on('error', reject);
  });
}

/* 取真实客户端 IP：优先反向代理的 X-Forwarded-For，其次 TCP 连接地址 */
function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  let ip = fwd || (req.socket && req.socket.remoteAddress) || '';
  ip = ip.replace(/^::ffff:/, '');
  if (ip === '::1') ip = '127.0.0.1';
  return ip;
}

/* 分页参数兜底：非数字/空值回落到默认值，并夹到合理区间，避免 NaN 传进 SQLite 抛异常 */
function intParam(value, fallback, min, max) {
  const n = Number.parseInt(value, 10);
  const base = Number.isFinite(n) ? n : fallback;
  return Math.min(Math.max(base, min), max);
}

/* 发布者身份筛选：只接受白名单值，其余（含空、拼错）一律当成「全部」 */
function roleParam(value) {
  const v = String(value || '').trim().toLowerCase();
  return ADMIN_ROLE_FILTERS.includes(v) ? v : '';
}

function saveUpload(req, dest, limit) {
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(dest);
    let size = 0;
    let done = false;
    const fail = (msg) => {
      if (done) return;
      done = true;
      out.destroy();
      fs.unlink(dest, () => {});
      reject(new Error(msg));
    };
    req.on('data', (c) => {
      if (done) return;
      size += c.length;
      if (size > limit) return fail('文件超过 ' + Math.round(limit / 1024 / 1024) + 'MB');
      out.write(c);
    });
    req.on('end', () => {
      if (done) return;
      out.end(() => {
        done = true;
        resolve(size);
      });
    });
    req.on('error', fail);
  });
}

function requireAuth(req, res) {
  if (!req.user) {
    json(res, 401, { error: '请先登录' });
    return null;
  }
  if (req.user.banned) {
    json(res, 403, { error: '账号已被封禁' });
    return null;
  }
  return req.user;
}

function requireAdmin(req, res) {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (!user.is_admin) {
    json(res, 403, { error: '需要管理员权限' });
    return null;
  }
  return user;
}

function lanScore(ip) {
  if (/^192\.168\./.test(ip)) return 3;
  if (/^10\./.test(ip)) return 2;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 1;
  return 0;
}

function lanAddresses() {
  const virtual = /(docker|veth|vmnet|vmware|virtualbox|vbox|hyper-?v|vethernet|utun|br-|tun\d|tap\d|zerotier|tailscale|wsl)/i;
  const all = [];
  const real = [];
  const nets = os.networkInterfaces();
  Object.keys(nets).forEach((name) => {
    (nets[name] || []).forEach((net) => {
      if (net.family !== 'IPv4' || net.internal) return;
      const item = { iface: name, address: net.address };
      all.push(item);
      if (!virtual.test(name)) real.push(item);
    });
  });
  const out = real.length ? real : all;
  out.sort((a, b) => lanScore(b.address) - lanScore(a.address));
  return out;
}

/* 统计目录下所有文件的实际占用（字节与文件数） */
function dirUsage(dir) {
  let bytes = 0;
  let files = 0;
  const walk = (d) => {
    let ents;
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    ents.forEach((ent) => {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) { walk(p); return; }
      if (!ent.isFile()) return;
      try { bytes += fs.statSync(p).size; files += 1; } catch (e) { /* 文件可能刚被删除 */ }
    });
  };
  walk(dir);
  return { bytes, files };
}

/* ---------------- 媒体文件 ---------------- */

/* 媒体文件：客户端中断下载（切页、拖动进度条）会让 res 触发 error，
   未处理会直接结束进程，所以统一用带容错的管道 */
function pipeFile(file, res, opts) {
  const stream = fs.createReadStream(file, opts);
  stream.on('error', () => {
    try { res.destroy(); } catch (e) { /* 已断开 */ }
  });
  res.on('close', () => {
    try { stream.destroy(); } catch (e) { /* 已关闭 */ }
  });
  stream.pipe(res);
}

function serveMedia(req, res, id) {
  const row = db.prepare('SELECT * FROM media WHERE id = ?').get(id);
  if (!row) return json(res, 404, { error: '文件不存在' });

  const file = path.join(MEDIA_DIR, row.id);
  if (!fs.existsSync(file)) return json(res, 404, { error: '文件已丢失' });

  const total = fs.statSync(file).size;
  const range = req.headers.range;
  const type = row.mime || 'application/octet-stream';
  baseHeaders(res);

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : total - 1;
    if (isNaN(start) || start < 0) start = 0;
    if (isNaN(end) || end >= total) end = total - 1;
    if (start > end) {
      res.writeHead(416, { 'Content-Range': 'bytes */' + total });
      return res.end();
    }
    res.writeHead(206, {
      'Content-Type': type,
      'Content-Length': end - start + 1,
      'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable'
    });
    pipeFile(file, res, { start, end });
    return;
  }

  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': total,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable'
  });
  pipeFile(file, res);
}

/* ---------------- 静态文件（管理台） ---------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function serveStatic(pathname, res) {
  let rel = pathname;
  if (rel === '/' || rel === '/admin' || rel === '/admin/') rel = '/admin.html';
  let file = path.join(PUBLIC_DIR, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(PUBLIC_DIR)) return text(res, 403, 'Forbidden');
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return text(res, 404, 'Not Found');
  const ext = path.extname(file).toLowerCase();
  const buf = fs.readFileSync(file);
  baseHeaders(res);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': buf.length,
    'Cache-Control': 'no-cache'
  });
  res.end(buf);
}

/* ---------------- 连接自检页（手机打开确认网络是否互通） ---------------- */

function checkPage() {
  const lan = lanAddresses();
  const best = lan.length ? 'http://' + lan[0].address + ':' + listenPort : '';
  return `<!doctype html>
<html lang="zh-CN"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>U 连接自检</title>
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;
  background:linear-gradient(160deg,#171228,#0b0b12 70%);color:#f2f2f6;
  font-family:-apple-system,"PingFang SC","Noto Sans SC",system-ui,sans-serif}
.card{width:100%;max-width:420px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);
  border-radius:24px;padding:26px;backdrop-filter:blur(20px);box-shadow:0 24px 70px rgba(0,0,0,.5)}
.logo{width:46px;height:46px;border-radius:14px;background:#000;color:#fff;display:grid;place-items:center;
  font-weight:800;font-size:22px;margin-bottom:18px}
h1{margin:0 0 8px;font-size:22px}
.state{color:#18c090;font-size:13.5px;font-weight:600;margin:0 0 20px;line-height:1.6}
.box{background:rgba(139,92,246,.12);border:1px solid rgba(139,92,246,.3);border-radius:16px;padding:14px;margin-bottom:14px}
.box b{display:block;font-size:12px;color:#b9b9cc;margin-bottom:8px;font-weight:600}
code{display:block;font-size:17px;font-weight:800;color:#c9b6ff;word-break:break-all;line-height:1.4}
button{width:100%;border:0;border-radius:999px;padding:13px;background:linear-gradient(140deg,#8b5cf6,#6366f1);
  color:#fff;font-size:15px;font-weight:800;margin-bottom:18px}
button:active{opacity:.85}
.tips{border-top:1px solid rgba(255,255,255,.08);padding-top:14px}
.tips p{margin:0 0 9px;font-size:13px;color:#9a9ab0;line-height:1.6}
.tips p:last-child{margin-bottom:0}
.meta{margin-top:16px;font-size:11.5px;color:#6f6f85}
</style></head>
<body>
<div class="card">
  <div class="logo">U</div>
  <h1>服务器在线</h1>
  <p class="state">这个页面能打开，说明手机和电脑的网络是通的。</p>
  <div class="box"><b>App 设置 → 后台服务器地址，填这个</b><code id="addr">${best || '未检测到局域网地址'}</code></div>
  <button id="copy">复制地址</button>
  <div class="tips">
    <p>1. 不要填 127.0.0.1，也不要带 /admin</p>
    <p>2. 手机和电脑要连同一个 Wi-Fi</p>
    <p>3. 电脑防火墙要允许 Node.js 访问网络</p>
  </div>
  <div class="meta">端口 ${listenPort} · 运行 ${Math.round((Date.now() - startedAt) / 1000)} 秒</div>
</div>
<script>
var btn = document.getElementById('copy');
btn.onclick = function () {
  var t = document.getElementById('addr').textContent;
  var done = function () { btn.textContent = '已复制'; setTimeout(function () { btn.textContent = '复制地址'; }, 1500); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(done, done);
  } else {
    var i = document.createElement('input');
    i.value = t; document.body.appendChild(i); i.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(i); done();
  }
};
</script>
</body></html>`;
}

/* ---------------- 路由 ---------------- */

async function route(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);
  const method = req.method.toUpperCase();

  const authHeader = req.headers.authorization || '';
  req.token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  req.user = sessionUser(req.token);
  if (!req.user && url.searchParams.get('token')) {
    req.user = sessionUser(url.searchParams.get('token'));
  }

  if (method === 'OPTIONS') {
    baseHeaders(res);
    res.writeHead(204);
    return res.end();
  }

  if (pathname === '/api' || pathname === '/api/') {
    return json(res, 200, {
      name: 'U Server',
      version: '1.0.0',
      docs: '/admin 网页管理台',
      endpoints: [
        'POST /api/register  {username,password,nickname}',
        'POST /api/login     {username,password}',
        'POST /api/guest     游客登录，返回匿名账号 token',
        'POST /api/logout',
        'GET  /api/me',
        'GET  /api/users/:id',
        'GET  /api/users/:username',
        'POST /api/users/:username/follow',
        'GET  /api/users/:username/activity',
        'GET  /api/search?q=关键词',
        'GET  /api/notifications',
        'POST /api/notifications/read  {ids:[通知ID]}，省略 ids 则全部已读',
        'GET  /api/conversations',
        'GET|POST /api/messages/:username',
        'GET  /api/post-ids',
        'GET  /api/posts?offset=0&limit=20&author=用户名',
        'POST /api/posts     {text,private,media:[mediaId]}',
        'GET  /api/posts/:id',
        'POST /api/posts/:id/view',
        'DELETE /api/posts/:id',
        'POST /api/posts/:id/like',
        'POST /api/posts/:id/repost',
        'GET  /api/posts/:id/comments',
        'POST /api/posts/:id/comments  {text,replyTo}',
        'POST /api/media     原始二进制上传，Header: X-Filename, Content-Type',
        'GET  /media/:id',
        'GET  /api/health'
      ]
    });
  }

  if ((pathname === '/check' || pathname === '/check/') && method === 'GET') {
    return text(res, 200, checkPage(), 'text/html; charset=utf-8');
  }

  if (pathname === '/api/health' && method === 'GET') {
    return json(res, 200, {
      ok: true,
      app: 'U',
      uptime: Math.round((Date.now() - startedAt) / 1000),
      time: new Date().toISOString()
    });
  }

  /* 局域网自动发现：App 找不到服务器地址时，扫描网段逐个打这个接口确认身份 */
  if ((pathname === '/api/discover' || pathname === '/api/find') && method === 'GET') {
    return json(res, 200, {
      ok: true,
      app: 'U',
      api: 1,
      name: os.hostname(),
      port: listenPort,
      lan: lanAddresses().map((a) => 'http://' + a.address + ':' + listenPort),
      udp: DISCOVER_PORT,
      time: new Date().toISOString()
    });
  }

  /* App 启动时读取的站点配置：上传大小限制、全站开关、隐藏的服务菜单 */
  if (pathname === '/api/config' && method === 'GET') {
    const cfg = getSettings();
    return json(res, 200, {
      ok: true,
      mediaMaxPerPost: cfg.mediaMaxPerPost,
      botIntervalSec: cfg.botIntervalSec,
      settings: cfg,
      serviceKeys: SERVICE_KEYS
    });
  }

  /* ---- 账号 ---- */

  if (pathname === '/api/register' && method === 'POST') {
    const b = await readJson(req);
    try {
      const user = createUser({ username: b.username, nickname: b.nickname, password: b.password });
      /* 新账号与官方账号真实互相关注：关注/粉丝数都来自 follows 表 */
      try { welcomeNewUser(user.id); } catch (e) { /* 官方账号异常不影响注册 */ }
      const s = createSession(user.id);
      addLog({
        type: 'register',
        userId: user.id,
        username: user.username,
        ip: clientIp(req),
        detail: '注册成功，昵称：' + user.nickname
      });
      return json(res, 201, { token: s.token, expiresAt: s.expiresAt, user: publicUser(user) });
    } catch (err) {
      addLog({
        type: 'register_fail',
        username: String(b.username || '').trim().toLowerCase(),
        ip: clientIp(req),
        detail: '注册失败：' + (err.message || '未知错误')
      });
      throw err;
    }
  }

  if (pathname === '/api/login' && method === 'POST') {
    const b = await readJson(req);
    const ip = clientIp(req);
    const name = String(b.username || '').trim().toLowerCase();
    const user = findUserByName(b.username);
    if (!user) {
      addLog({ type: 'login_fail', username: name, ip, detail: '账号不存在' });
      return json(res, 401, { error: '账号或密码错误' });
    }
    if (!verifyPassword(b.password, user.salt, user.pass_hash)) {
      addLog({ type: 'login_fail', userId: user.id, username: user.username, ip, detail: '密码错误' });
      return json(res, 401, { error: '账号或密码错误' });
    }
    if (user.banned) {
      addLog({ type: 'login_fail', userId: user.id, username: user.username, ip, detail: '账号已被封禁，拒绝登录' });
      return json(res, 403, { error: '账号已被封禁' });
    }
    const s = createSession(user.id);
    addLog({
      type: 'login_ok',
      userId: user.id,
      username: user.username,
      ip,
      detail: '登录成功' + (user.is_admin ? '（管理员）' : '')
    });
    return json(res, 200, { token: s.token, expiresAt: s.expiresAt, user: publicUser(user) });
  }

  /* 游客登录：服务器发放一个匿名账号，游客发的帖子/评论也存服务器 */
  if (pathname === '/api/guest' && method === 'POST') {
    const user = createGuestUser();
    const s = createSession(user.id);
    addLog({
      type: 'guest',
      userId: user.id,
      username: user.username,
      ip: clientIp(req),
      detail: '游客登录'
    });
    return json(res, 201, { token: s.token, expiresAt: s.expiresAt, user: publicUser(user) });
  }

  if (pathname === '/api/logout' && method === 'POST') {
    deleteSession(req.token);
    return json(res, 200, { ok: true });
  }

  if (pathname === '/api/me' && method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return;
    const counts = userCounts(user.id);
    return json(res, 200, {
      user: publicUser(user),
      followers: counts.followers,
      following: counts.following,
      postCount: counts.postCount
    });
  }

  /* 修改账号 / 昵称：账号普通用户 30 天一次，管理员不限次数 */
  if (pathname === '/api/me/profile' && method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    const b = await readJson(req);
    const updated = updateProfile(user.id, {
      username: b.username === undefined ? undefined : b.username,
      nickname: b.nickname === undefined ? undefined : b.nickname
    });
    if (updated.username !== user.username) {
      addLog({
        type: 'account',
        userId: user.id,
        username: updated.username,
        ip: clientIp(req),
        detail: '修改账号：@' + user.username + ' → @' + updated.username
      });
    }
    return json(res, 200, { ok: true, user: publicUser(updated) });
  }

  let m = /^\/api\/users\/(\d+)$/.exec(pathname);
  /* 注册允许纯数字用户名，这类名字要优先按用户名解析，不能一律当 id */
  if (m && method === 'GET' && !findUserByName(m[1])) {
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(m[1]));
    if (!u) return json(res, 404, { error: '用户不存在' });
    const postCount = db.prepare('SELECT COUNT(*) AS n FROM posts WHERE user_id = ?').get(u.id).n;
    return json(res, 200, { user: Object.assign(publicUser(u), { postCount }) });
  }

  m = /^\/api\/users\/([A-Za-z0-9_]+)$/.exec(pathname);
  if (m && method === 'GET') {
    const profile = userProfile(m[1], req.user ? req.user.id : 0);
    if (!profile) return json(res, 404, { error: '用户不存在' });
    return json(res, 200, profile);
  }

  m = /^\/api\/users\/([A-Za-z0-9_]+)\/follow$/.exec(pathname);
  if (m && method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    const target = findUserByName(m[1]);
    if (!target) return json(res, 404, { error: '用户不存在' });
    return json(res, 200, toggleFollow(user.id, target.id));
  }

  m = /^\/api\/users\/([A-Za-z0-9_]+)\/(followers|following)$/.exec(pathname);
  if (m && method === 'GET') {
    const list = userFollowList(m[1], m[2], req.user ? req.user.id : 0);
    if (!list) return json(res, 404, { error: '用户不存在' });
    return json(res, 200, { users: list });
  }

  m = /^\/api\/users\/([A-Za-z0-9_]+)\/activity$/.exec(pathname);
  if (m && method === 'GET') {
    const activity = userActivity(m[1], req.user ? req.user.id : 0);
    if (!activity) return json(res, 404, { error: '用户不存在' });
    return json(res, 200, activity);
  }

  if (pathname === '/api/search' && method === 'GET') {
    return json(res, 200, search(url.searchParams.get('q') || '', req.user ? req.user.id : 0));
  }

  /* ---- 点赞、评论与关注提醒 ---- */

  if (pathname === '/api/notifications' && method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return;
    const notifications = listNotifications(user.id);
    return json(res, 200, {
      notifications,
      unread: notifications.reduce((n, item) => n + (item.read ? 0 : 1), 0)
    });
  }

  if (pathname === '/api/notifications/read' && method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    const b = await readJson(req);
    markNotificationsRead(user.id, b.ids);
    return json(res, 200, { ok: true });
  }

  /* ---- 私信 ---- */

  if (pathname === '/api/conversations' && method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return;
    return json(res, 200, { conversations: listConversations(user.id) });
  }

  m = /^\/api\/messages\/([A-Za-z0-9_]+)$/.exec(pathname);
  if (m && (method === 'GET' || method === 'POST')) {
    const user = requireAuth(req, res);
    if (!user) return;
    const target = findUserByName(m[1]);
    if (!target) return json(res, 404, { error: '用户不存在' });
    if (method === 'POST') {
      const b = await readJson(req);
      return json(res, 201, { message: sendMessage(user.id, target.id, b.text) });
    }
    return json(res, 200, { messages: listMessages(user.id, target.id) });
  }

  /* ---- 帖子 ---- */

  /* 只返回全部帖子 ID，供 App 检测「服务器已删除」的帖子（不受分页限制） */
  if (pathname === '/api/post-ids' && method === 'GET') {
    const viewerId = req.user ? req.user.id : 0;
    const ids = db
      .prepare('SELECT id FROM posts WHERE private = 0 OR user_id = ? ORDER BY id DESC')
      .all(viewerId)
      .map((r) => r.id);
    return json(res, 200, { ids });
  }

  if (pathname === '/api/posts' && method === 'GET') {
    const offset = intParam(url.searchParams.get('offset'), 0, 0, 1e9);
    const limit = intParam(url.searchParams.get('limit'), 20, 1, 100);
    const authorName = url.searchParams.get('author');
    let authorId = 0;
    if (authorName) {
      const u = findUserByName(authorName);
      if (!u) return json(res, 200, { posts: [], hasMore: false });
      authorId = u.id;
    }
    const posts = listPosts({
      viewerId: req.user ? req.user.id : 0,
      authorId,
      offset,
      limit
    });
    return json(res, 200, { posts, hasMore: posts.length >= Math.min(Math.max(limit, 1), 100) });
  }

  if (pathname === '/api/posts' && method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    const cfg = getSettings();
    if (!cfg.allowPost) return json(res, 403, { error: '管理员已关闭全站发帖' });
    if (user.muted) return json(res, 403, { error: '你已被禁言，暂时不能发布内容' });
    const b = await readJson(req);
    const mediaIds = Array.isArray(b.media) ? b.media : [];
    const mediaLimit = intParam(cfg.mediaMaxPerPost, 9, 1, 9);
    if (mediaIds.length > mediaLimit) {
      return json(res, 400, { error: '一条帖子最多 ' + mediaLimit + ' 个图片或视频' });
    }
    const id = createPost({
      userId: user.id,
      text: b.text,
      private: !!b.private,
      sensitive: !!b.sensitive,
      mediaIds,
      bot: false
    });
    const mediaCount = mediaIds.length;
    addLog({
      type: 'post',
      userId: user.id,
      username: user.username,
      ip: clientIp(req),
      detail:
        '发帖 #' + id +
        (mediaCount ? '（' + mediaCount + ' 个媒体）' : '') +
        (b.private ? '（私密）' : '') +
        (b.sensitive ? '（18+）' : '') +
        (b.text ? '：' + String(b.text).slice(0, 80) : '')
    });
    return json(res, 201, { post: getPost(id, user.id) });
  }

  /* 真实浏览量：帖子被看到时 +1（同一账号/IP 30 分钟内只计一次） */
  m = /^\/api\/posts\/(\d+)\/view$/.exec(pathname);
  if (m && method === 'POST') {
    const postId = Number(m[1]);
    const key = (req.token || clientIp(req)) + '|' + postId;
    const last = viewTouch.get(key) || 0;
    if (Date.now() - last < VIEW_TTL) {
      const post = getPost(postId, req.user ? req.user.id : 0);
      if (!post) return json(res, 404, { error: '帖子不存在' });
      return json(res, 200, { ok: true, views: post.viewCount });
    }
    if (viewTouch.size > 5000) viewTouch.clear();
    const views = bumpPostView(postId);
    if (views === null) return json(res, 404, { error: '帖子不存在' });
    viewTouch.set(key, Date.now());
    return json(res, 200, { ok: true, views });
  }

  m = /^\/api\/posts\/(\d+)$/.exec(pathname);
  if (m && method === 'GET') {
    const post = getPost(Number(m[1]), req.user ? req.user.id : 0);
    if (!post) return json(res, 404, { error: '帖子不存在或无权查看' });
    return json(res, 200, { post });
  }

  if (m && method === 'DELETE') {
    const user = requireAuth(req, res);
    if (!user) return;
    const row = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(Number(m[1]));
    if (!row) return json(res, 404, { error: '帖子不存在' });
    if (row.user_id !== user.id && !user.is_admin) return json(res, 403, { error: '无权删除' });
    deletePost(Number(m[1]));
    return json(res, 200, { ok: true });
  }

  /* 编辑已发布的帖子：只有本人能改文字 / 私密 / 18+ 标注，媒体不走这里 */
  if (m && method === 'PATCH') {
    const user = requireAuth(req, res);
    if (!user) return;
    const b = await readJson(req);
    let updated = null;
    try {
      updated = updatePostMeta(Number(m[1]), user.id, {
        text: b.text,
        private: b.private,
        sensitive: b.sensitive
      });
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
    if (!updated) return json(res, 404, { error: '帖子不存在或无权修改' });
    return json(res, 200, { post: updated });
  }

  m = /^\/api\/posts\/(\d+)\/like$/.exec(pathname);
  if (m && method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!db.prepare('SELECT 1 AS x FROM posts WHERE id = ?').get(Number(m[1]))) {
      return json(res, 404, { error: '帖子不存在' });
    }
    return json(res, 200, toggleLike(Number(m[1]), user.id));
  }

  m = /^\/api\/posts\/(\d+)\/repost$/.exec(pathname);
  if (m && method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!getSettings().allowPost) return json(res, 403, { error: '管理员已关闭全站发帖' });
    if (user.muted) return json(res, 403, { error: '你已被禁言，暂时不能转发' });
    if (!db.prepare('SELECT 1 AS x FROM posts WHERE id = ?').get(Number(m[1]))) {
      return json(res, 404, { error: '帖子不存在' });
    }
    return json(res, 200, toggleRepost(Number(m[1]), user.id));
  }

  m = /^\/api\/posts\/(\d+)\/comments$/.exec(pathname);
  if (m && method === 'GET') {
    if (!getPost(Number(m[1]), req.user ? req.user.id : 0)) {
      return json(res, 404, { error: '帖子不存在或无权查看' });
    }
    return json(res, 200, { comments: listComments(Number(m[1])) });
  }

  if (m && method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    if (m && !getSettings().allowComment) return json(res, 403, { error: '管理员已关闭全站评论' });
    if (m && user.muted) return json(res, 403, { error: '你已被禁言，暂时不能评论' });
    if (!getPost(Number(m[1]), user.id)) return json(res, 404, { error: '帖子不存在或无权查看' });
    const b = await readJson(req);
    addComment(Number(m[1]), user.id, b.text, b.replyTo);
    addLog({
      type: 'comment',
      userId: user.id,
      username: user.username,
      ip: clientIp(req),
      detail: '评论帖子 #' + m[1] + (b.text ? '：' + String(b.text).slice(0, 60) : '')
    });
    return json(res, 201, { comments: listComments(Number(m[1])) });
  }

  /* ---- 媒体上传 ---- */

  if (pathname === '/api/media' && method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    const rawName = String(req.headers['x-filename'] || 'file').slice(-120);
    const filename = rawName.replace(/[^\w.\-\u4e00-\u9fa5]/g, '_') || 'file';
    let mime = String(req.headers['content-type'] || 'application/octet-stream').split(';')[0].trim().toLowerCase();
    /* 有些手机 WebView / 第三方 App 上传时给的是 application/octet-stream 或空类型，
       这里按文件名兜底猜一次，否则图片视频会被当成非法类型直接拒收 */
    if (!/^image\//.test(mime) && !/^video\//.test(mime)) {
      const ext = path.extname(filename).toLowerCase();
      const guess = {
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
        '.gif': 'image/gif', '.heic': 'image/heic', '.heif': 'image/heif', '.bmp': 'image/bmp',
        '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
        '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo', '.3gp': 'video/3gpp'
      }[ext];
      if (guess) mime = guess;
    }
    if (!/^image\//.test(mime) && !/^video\//.test(mime)) {
      return json(res, 400, { error: '只支持图片或视频' });
    }
    const id = crypto.randomBytes(12).toString('hex');
    const dest = path.join(MEDIA_DIR, id);
    const isVideo = /^video\//.test(mime);
    const cfg = getSettings();
    const limit = (isVideo ? cfg.uploadVideoMB : cfg.uploadImageMB) * 1024 * 1024;
    const size = await saveUpload(req, dest, limit);
    /* 上传本身不限制数量（媒体可先传后发帖），条数上限在 POST /api/posts 校验 */
    recordMedia({ id, userId: user.id, filename, mime, size, bot: false });
    return json(res, 201, { id, url: '/media/' + id, mime, size });
  }

  /* 补封面：给已经上传过的视频补一张首帧图。
     App 端在渲染/首次播放时抓一帧传上来，之后所有人直接看封面，不用再为封面下载视频。 */
  const posterRoute = /^\/api\/media\/([a-f0-9]{24})\/poster$/.exec(pathname);
  if (posterRoute && method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    const target = db.prepare('SELECT id, user_id FROM media WHERE id = ?').get(posterRoute[1]);
    if (!target) return json(res, 404, { error: '视频不存在' });
    /* 本人或管理员可以补封面（管理员用来给历史视频回填） */
    if (target.user_id !== user.id && !user.is_admin) return json(res, 403, { error: '只能给自己的视频补封面' });
    const cfg = getSettings();
    const id = crypto.randomBytes(12).toString('hex');
    const dest = path.join(MEDIA_DIR, id);
    const size = await saveUpload(req, dest, cfg.uploadImageMB * 1024 * 1024);
    recordMedia({ id, userId: user.id, filename: 'cover.jpg', mime: 'image/jpeg', size, bot: false });
    const ratio = Number(req.headers['x-ratio'] || 0) || 0;
    /* 媒体归属者是原视频的主人：管理员回填时也要按归属者写，否则 UPDATE 命中 0 行 */
    setMediaPoster(posterRoute[1], id, target.user_id, ratio);
    return json(res, 201, { poster: '/media/' + id, ratio });
  }

  m = /^\/media\/([a-f0-9]{24})$/.exec(pathname);
  if (m && (method === 'GET' || method === 'HEAD')) {
    return serveMedia(req, res, m[1]);
  }

  /* ---- 管理接口 ---- */

  if (pathname === '/api/admin/overview' && method === 'GET') {
    if (!requireAdmin(req, res)) return;
    let dbSize = 0;
    try {
      dbSize = fs.statSync(path.join(DATA_DIR, 'u.db')).size;
    } catch (e) {
      /* 数据库尚未落盘 */
    }
    const mem = process.memoryUsage();
    return json(res, 200, {
      stats: stats(),
      settings: getSettings(),
      server: {
        uptime: Math.round((Date.now() - startedAt) / 1000),
        port: listenPort,
        node: process.version,
        platform: process.platform + ' ' + process.arch,
        dbSize,
        dataDir: DATA_DIR,
        rss: mem.rss,
        mediaDir: MEDIA_DIR,
        mediaDisk: dirUsage(MEDIA_DIR),
        dataDisk: dirUsage(DATA_DIR),
        addresses: lanAddresses()
      },
      dataDir: dataDirInfo()
    });
  }

  /* ---- 操作日志 ---- */

  if (pathname === '/api/admin/logs' && method === 'GET') {
    if (!requireAdmin(req, res)) return;
    return json(
      res,
      200,
      listLogs({
        type: url.searchParams.get('type') || '',
        q: url.searchParams.get('q') || '',
        offset: intParam(url.searchParams.get('offset'), 0, 0, 1e9),
        limit: intParam(url.searchParams.get('limit'), 50, 1, 300)
      })
    );
  }

  if (pathname === '/api/admin/logs/clear' && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    clearLogs();
    return json(res, 200, { ok: true });
  }

  /* 从日志直接拉黑：优先按 userId，找不到再按用户名匹配 */
  if (pathname === '/api/admin/logs/blacklist' && method === 'POST') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const b = await readJson(req);
    let target = b.userId ? db.prepare('SELECT * FROM users WHERE id = ?').get(Number(b.userId)) : null;
    if (!target && b.username) target = findUserByName(b.username);
    if (!target) return json(res, 404, { error: '未找到该账号，无法拉黑' });
    if (target.is_admin) return json(res, 400, { error: '不能拉黑管理员' });
    setBanned(target.id, true);
    addLog({
      type: 'admin',
      userId: admin.id,
      username: admin.username,
      ip: clientIp(req),
      detail: '拉黑账号：' + target.username
    });
    return json(res, 200, { ok: true, user: { id: target.id, username: target.username } });
  }

  if (pathname === '/api/admin/users' && method === 'GET') {
    if (!requireAdmin(req, res)) return;
    const role = roleParam(url.searchParams.get('role'));
    const q = url.searchParams.get('q') || '';
    return json(res, 200, { users: adminUsers(q, role), total: adminUsersTotal(q, role), role });
  }

  /* 批量删除账号（自动跳过管理员和当前登录账号） */
  if (pathname === '/api/admin/users/bulk-delete' && method === 'POST') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const b = await readJson(req);
    const result = deleteUsers(b.ids, admin.id);
    addLog({
      type: 'admin',
      userId: admin.id,
      username: admin.username,
      ip: clientIp(req),
      detail: '批量删除账号：成功 ' + result.deleted + ' 个，跳过 ' + result.skipped + ' 个'
    });
    return json(res, 200, { ok: true, ...result });
  }

  m = /^\/api\/admin\/users\/(\d+)\/ban$/.exec(pathname);
  if (m && method === 'POST') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const id = Number(m[1]);
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!target) return json(res, 404, { error: '用户不存在' });
    if (target.is_admin) return json(res, 400, { error: '不能封禁管理员' });
    const b = await readJson(req);
    setBanned(id, !!b.banned);
    return json(res, 200, { ok: true, banned: !!b.banned });
  }

  m = /^\/api\/admin\/users\/(\d+)\/mute$/.exec(pathname);
  if (m && method === 'POST') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const id = Number(m[1]);
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!target) return json(res, 404, { error: '用户不存在' });
    if (target.is_admin) return json(res, 400, { error: '不能禁言管理员' });
    const b = await readJson(req);
    setMuted(id, !!b.muted);
    return json(res, 200, { ok: true, muted: !!b.muted });
  }

  /* 管理员重置账号密码（数据库中只保存哈希，不能查看原密码） */
  m = /^\/api\/admin\/users\/(\d+)\/password$/.exec(pathname);
  if (m && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const id = Number(m[1]);
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!target) return json(res, 404, { error: '用户不存在' });
    if (target.is_guest) return json(res, 400, { error: '游客账号没有密码' });
    const b = await readJson(req);
    setPassword(id, b.password);
    return json(res, 200, { ok: true });
  }

  m = /^\/api\/admin\/users\/(\d+)$/.exec(pathname);
  if (m && method === 'DELETE') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const id = Number(m[1]);
    if (id === admin.id) return json(res, 400, { error: '不能删除当前登录的管理员' });
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!target) return json(res, 404, { error: '用户不存在' });
    deleteUser(id);
    return json(res, 200, { ok: true });
  }

  if (pathname === '/api/admin/settings' && method === 'GET') {
    if (!requireAdmin(req, res)) return;
    return json(res, 200, { settings: getSettings(), serviceKeys: SERVICE_KEYS });
  }

  if (pathname === '/api/admin/settings' && method === 'POST') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const b = await readJson(req);
    const saved = saveSettings(b, admin.username || 'admin');
    /* 人机间隔可能变了：按新设置重建定时器 */
    restartBotEngine();
    return json(res, 200, {
      ok: true,
      settings: saved,
      serviceKeys: SERVICE_KEYS
    });
  }

  if (pathname === '/api/admin/admins' && method === 'GET') {
    if (!requireAdmin(req, res)) return;
    return json(res, 200, { admins: listAdmins() });
  }

  if (pathname === '/api/admin/admins' && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const b = await readJson(req);
    const user = createAdmin({ username: b.username, password: b.password, nickname: b.nickname });
    return json(res, 201, { ok: true, user });
  }

  m = /^\/api\/admin\/admins\/(\d+)\/demote$/.exec(pathname);
  if (m && method === 'POST') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const id = Number(m[1]);
    if (id === admin.id) return json(res, 400, { error: '不能取消自己的管理员身份' });
    demoteAdmin(id);
    return json(res, 200, { ok: true });
  }

  if (pathname === '/api/admin/posts' && method === 'GET') {
    if (!requireAdmin(req, res)) return;
    const q = url.searchParams.get('q') || '';
    const role = roleParam(url.searchParams.get('role'));
    return json(res, 200, {
      posts: adminPosts({ q, role, offset: intParam(url.searchParams.get('offset'), 0, 0, 1e9), limit: 50 }),
      total: adminPostsTotal({ q, role }),
      role
    });
  }

  m = /^\/api\/admin\/posts\/(\d+)$/.exec(pathname);
  if (m && method === 'DELETE') {
    if (!requireAdmin(req, res)) return;
    deletePost(Number(m[1]));
    return json(res, 200, { ok: true });
  }

  /* 管理台直接写入浏览量：0..99999999，非法值一律夹到区间内，避免 NaN 进 SQL */
  m = /^\/api\/admin\/posts\/(\d+)\/views$/.exec(pathname);
  if (m && method === 'POST') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const postId = Number(m[1]);
    const b = await readJson(req);
    const parsed = Number.parseInt(b.views, 10);
    if (!Number.isFinite(parsed)) return json(res, 400, { error: '浏览量必须是 0..99999999 之间的整数' });
    const views = intParam(parsed, 0, 0, 99999999);
    const before = db.prepare('SELECT views FROM posts WHERE id = ?').get(postId);
    if (!before) return json(res, 404, { error: '帖子不存在' });
    db.prepare('UPDATE posts SET views = ? WHERE id = ?').run(views, postId);
    addConfigHistory({
      scope: 'settings', action: 'update', field: 'post.views',
      oldValue: String(before.views || 0), newValue: String(views),
      note: '管理台修改帖子 #' + postId + ' 浏览量', actor: admin.username, ip: clientIp(req)
    });
    return json(res, 200, { ok: true, views });
  }

  if (pathname === '/api/admin/posts/bulk-delete' && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const b = await readJson(req);
    deleteManyPosts(b.ids);
    return json(res, 200, { ok: true, count: (b.ids || []).length });
  }

  if (pathname === '/api/admin/posts/clear' && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    deleteAllPosts();
    return json(res, 200, { ok: true });
  }

  /* 管理台：评论详情 */
  if (pathname === '/api/admin/comments' && method === 'GET') {
    if (!requireAdmin(req, res)) return;
    const q = url.searchParams.get('q') || '';
    const postId = intParam(url.searchParams.get('postId'), 0, 0, 1e9);
    const role = roleParam(url.searchParams.get('role'));
    return json(res, 200, {
      comments: adminComments({
        q,
        postId,
        role,
        offset: intParam(url.searchParams.get('offset'), 0, 0, 1e9),
        limit: intParam(url.searchParams.get('limit'), 100, 1, 300)
      }),
      total: adminCommentsTotal({ q, postId, role }),
      role
    });
  }

  m = /^\/api\/admin\/comments\/(\d+)$/.exec(pathname);
  if (m && method === 'DELETE') {
    if (!requireAdmin(req, res)) return;
    deleteComment(Number(m[1]));
    return json(res, 200, { ok: true });
  }

  if (pathname === '/api/admin/comments/bulk-delete' && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const b = await readJson(req);
    deleteManyComments(b.ids);
    return json(res, 200, { ok: true, count: (b.ids || []).length });
  }

  if (pathname === '/api/admin/comments/clear' && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    deleteAllComments();
    return json(res, 200, { ok: true });
  }

  /* 管理台：媒体（图片 / 视频） */
  if (pathname === '/api/admin/media' && method === 'GET') {
    if (!requireAdmin(req, res)) return;
    const q = url.searchParams.get('q') || '';
    const role = roleParam(url.searchParams.get('role'));
    return json(res, 200, {
      media: adminMedia({
        q,
        role,
        offset: intParam(url.searchParams.get('offset'), 0, 0, 1e9),
        limit: intParam(url.searchParams.get('limit'), 100, 1, 300)
      }),
      total: adminMediaTotal({ q, role }),
      role
    });
  }

  if (pathname === '/api/admin/media/bulk-delete' && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const b = await readJson(req);
    deleteManyMedia(b.ids);
    return json(res, 200, { ok: true, count: (b.ids || []).length });
  }

  if (pathname === '/api/admin/media/clear' && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    deleteAllMedia();
    return json(res, 200, { ok: true });
  }

  m = /^\/api\/admin\/media\/([a-f0-9]{24})$/.exec(pathname);
  if (m && method === 'DELETE') {
    if (!requireAdmin(req, res)) return;
    deleteMedia(m[1]);
    return json(res, 200, { ok: true });
  }

  if (pathname === '/api/admin/backup' && method === 'GET') {
    if (!requireAdmin(req, res)) return;
    return json(res, 200, { backup: backupInfo() });
  }

  /* 立即备份：生成 data/backup/<时间戳>-manual/ 目录（数据库 + 图片视频） */
  if (pathname === '/api/admin/backup' && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const body = await readJson(req);
    const meta = createBackup(body && body.reason ? 'manual' : 'manual');
    const info = backupInfo();
    addLog({ type: 'admin', userId: 0, username: '', ip: clientIp(req), detail: '手动备份：' + meta.name });
    return json(res, 200, {
      ok: true,
      name: meta.name,
      file: meta.name,
      size: meta.bytes,
      mediaFiles: meta.mediaFiles,
      counts: meta.counts,
      dir: path.join(DATA_DIR, 'backup'),
      backup: info
    });
  }

  /* 备份文件列表：数据目录 backup/ 下的 .db / .zip / .json */
  if (pathname === '/api/admin/backups' && method === 'GET') {
    if (!requireAdmin(req, res)) return;
    return json(res, 200, {
      ok: true,
      dir: path.join(DATA_DIR, 'backup'),
      items: listBackups()
    });
  }

  if (pathname === '/api/admin/backups' && method === 'DELETE') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const body = await readJson(req);
    try {
      const r = deleteBackup(body.name, { actor: admin.username, ip: clientIp(req) });
      addLog({
        type: 'admin', userId: admin.id, username: admin.username, ip: clientIp(req),
        detail: '删除备份文件：' + r.name
      });
      return json(res, 200, { ok: true, name: r.name });
    } catch (e) {
      if (e.code === 'ENOENT') return json(res, 404, { error: '备份文件不存在' });
      return json(res, 400, { error: e.message });
    }
  }

  if (pathname === '/api/admin/data/clear' && method === 'POST') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const result = clearAppData();
    addLog({ type: 'admin', userId: admin.id, username: admin.username, ip: clientIp(req), detail: '清空全部数据' });
    return json(res, 200, { ok: true, ...result });
  }

  /* ── 数据目录（上传目录）：查看 / 修改 / 修改记录 ────────────────── */
  if (pathname === '/api/admin/data-dir' && method === 'GET') {
    if (!requireAdmin(req, res)) return;
    return json(res, 200, dataDirInfo());
  }

  if (pathname === '/api/admin/data-dir' && method === 'POST') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const body = await readJson(req, res);
    if (!body) return;
    try {
      const result = setDataDir(body.dir, {
        actor: admin.username,
        ip: clientIp(req),
        note: String(body.note || '')
      });
      addLog({
        type: 'admin', userId: admin.id, username: admin.username, ip: clientIp(req),
        detail: '修改数据目录 → ' + result.dir + (result.needRestart ? '（待重启生效）' : '')
      });
      return json(res, 200, { ok: true, ...result, current: dataDirInfo() });
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
  }

  /* 修改记录：数据目录 / 设置项 / 备份恢复 / 清空都会落表，这里读出来给管理台展示 */
  if (pathname === '/api/admin/history' && method === 'GET') {
    if (!requireAdmin(req, res)) return;
    const q = new URL(req.url, 'http://x').searchParams;
    return json(res, 200, listConfigHistory({
      scope: q.get('scope') || '',
      offset: intParam(q.get('offset'), 0, 0, 1e9),
      limit: intParam(q.get('limit'), 100, 1, 500)
    }));
  }

  if (pathname === '/api/admin/history/note' && method === 'POST') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const body = await readJson(req);
    const note = String(body.note || '').trim();
    if (!note) return json(res, 400, { error: '备注不能为空' });
    addConfigHistory({
      scope: String(body.scope || 'manual').slice(0, 32),
      action: 'note',
      field: String(body.field || '').slice(0, 64),
      oldValue: '',
      newValue: '',
      note,
      actor: admin.username,
      ip: clientIp(req)
    });
    return json(res, 200, { ok: true });
  }

  /* 清除修改记录：scope 为空则全清；清除动作本身也会留一条记录 */
  if (pathname === '/api/admin/history/clear' && method === 'POST') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const body = await readJson(req);
    try {
      const r = clearConfigHistory(body.scope, { actor: admin.username, ip: clientIp(req) });
      addLog({
        type: 'admin', userId: admin.id, username: admin.username, ip: clientIp(req),
        detail: '清除修改记录 ' + (body.scope || '全部') + '，共 ' + r.deleted + ' 条'
      });
      return json(res, 200, { ok: true, deleted: r.deleted });
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
  }

  /* 恢复：body.name 指定某一份备份，不传就用最近一份 */
  if (pathname === '/api/admin/data/restore' && method === 'POST') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const body = await readJson(req);
    if (!backupInfo().exists) return json(res, 400, { error: '暂无可恢复的备份' });
    let result = null;
    try {
      result = restoreAppData(body && body.name ? body.name : '');
    } catch (e) {
      if (e && e.code === 'ENOENT') return json(res, 404, { error: '这份备份不存在' });
      throw e;
    }
    addLog({ type: 'admin', userId: admin.id, username: admin.username, ip: clientIp(req), detail: '从备份恢复：' + result.name });
    /* 备份可能不含当前会话，恢复后为管理员补发一个 token，避免被踢出后台 */
    let token = null;
    if (!sessionUser(req.token)) {
      const row = db.prepare('SELECT id FROM users WHERE is_admin = 1 ORDER BY id LIMIT 1').get();
      if (row) token = createSession(row.id).token;
    }
    return json(res, 200, { ok: true, ...result, token });
  }

  if (pathname === '/api/admin/export' && method === 'GET') {
    if (!requireAdmin(req, res)) return;
    const dump = {
      exportedAt: new Date().toISOString(),
      users: db
        .prepare('SELECT id, username, nickname, is_admin, banned, created_at FROM users ORDER BY id')
        .all(),
      posts: db
        .prepare('SELECT id, user_id, text, private, created_at FROM posts ORDER BY id')
        .all(),
      comments: db.prepare('SELECT * FROM comments ORDER BY id').all(),
      likes: db.prepare('SELECT * FROM likes').all(),
      media: db.prepare('SELECT id, post_id, filename, mime, size, created_at FROM media').all()
    };
    const body = Buffer.from(JSON.stringify(dump, null, 2));
    baseHeaders(res);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="u-server-backup.json"',
      'Content-Length': body.length
    });
    return res.end(body);
  }

  if (pathname.startsWith('/api/')) return json(res, 404, { error: '接口不存在' });

  if (method === 'GET' || method === 'HEAD') return serveStatic(pathname, res);
  return json(res, 405, { error: '不支持的请求方法' });
}

/* ---------------- 人机引擎 ----------------
   管理台按「每 N 秒 M 条」配置四类动作（发帖 / 评论 / 点赞 / 私信）：
   botXxxEverySec = 间隔秒数，botXxxPerRound = 每一轮生成条数（0 表示该类关闭）。
   每类动作各有一个定时器，到点就一次性做 M 条，互不影响；
   旧字段 botXxxPerSec（每秒次数）由 db 层同步换算，供老版本 App 读取。
   人机内容真实写入数据库（走 db 层函数），所有客户端同步后看到的数据完全一致。 */
/* 人机语料：不再是一批固定句子，而是「前缀 + 事件 + 情绪」多段随机拼接，
   组合数上万，避免一眼看出是同一批模板。每段都是完整的短句，拼起来读着自然。 */
const BOT_PREFIX = [
  '刚', '今天', '昨晚', '早上', '下午', '中午', '周末', '这两天', '刚才', '下班后',
  '睡前', '出门前', '吃完饭', '收工之后', '一个人在家的时候', '等地铁的时候'
];

const BOT_EVENTS = [
  '去了趟菜市场', '把阳台的花浇了', '煮了锅小米粥', '在楼下吃了碗牛肉面', '整理了一遍衣柜',
  '在公园走了两圈', '学会用电饭煲做蛋糕', '把被子抱出去晒了', '追完了那部剧的最后一集',
  '把冰箱里的剩菜拼成一盘炒饭', '换了新的床单', '把窗户擦了一遍', '给绿萝换了盆',
  '在地铁上看完了一本书的最后两章', '晒了会儿太阳', '泡了壶茶坐在窗边',
  '修好了那把吱吱响的椅子', '把旧照片翻出来看了一遍', '给多肉挪了个更亮的位置',
  '顺手给邻居的猫喂了点粮'
];

const BOT_MOODS = [
  '心情一下子就好了。', '舒服得很。', '居然还挺治愈。', '感觉这周没白过。',
  '意外地顺利。', '有点上头，明天还想再来一次。', '累是累，但踏实。',
  '比预想的省事。', '看着干净就觉得值了。', '整个人都松下来了。',
  '挺普通的，但挺开心。', '说不上为什么，就是很满足。', '好像也没什么大不了。',
  '下次还想这么干。', '就是有点想睡觉了。', '安静得刚刚好。'
];

/* 偶发语气词/表情，让句子长短不一 */
const BOT_SPICE = ['', '', '', '', '哈哈。', '真的。', '嗯。', '就这样。', '记录一下。', '谁懂。'];

const BOT_COMMENT_OPEN = ['', '', '', '哈哈哈 ', '说真的，', '同感，', '不是，', '诶，'];
const BOT_COMMENT_BODY = [
  '看着就很舒服', '这个我也试过', '确实不错', '图呢，想看', '这日子过得挺讲究的',
  '简简单单最治愈', '学到了，改天试试', '我今天也这样', '说得太对了', '羡慕了',
  '有被治愈到', '这种小事最顶用', '我也想这么过一天', '好会生活啊'
];
const BOT_COMMENT_TAIL = ['。', '。', '～', '！', '哈哈哈', '真的。', ''];

/* 私信话术：更像真人突然搭话，不承诺任何事，也不带链接 */
const BOT_DM_OPEN = ['', '', '嗨，', '在吗，', '冒昧打扰一下，', '路过看到你的帖子，'];
const BOT_DM_BODY = [
  '你上次那条动态我看了好几遍，写得挺有意思的',
  '你那条生活记录拍得挺好看的',
  '想问问你平时都在哪家店买菜，看着挺新鲜',
  '你也在用这个 App 啊，感觉这里人不多',
  '看你发的那些，感觉你日子过得挺有条理',
  '你那边今天下雨了吗，我这边下了一整天',
  '想请教一下，那种照片是怎么拍的',
  '刚好刷到你，打个招呼'
];
const BOT_DM_TAIL = ['。', '～', '，随便聊聊。', '，不打扰了。', '，就这样。', ''];

function botSentence() {
  return randomOf(BOT_PREFIX) + randomOf(BOT_EVENTS) + '，' + randomOf(BOT_MOODS) + randomOf(BOT_SPICE);
}

function botCommentText() {
  return randomOf(BOT_COMMENT_OPEN) + randomOf(BOT_COMMENT_BODY) + randomOf(BOT_COMMENT_TAIL);
}

function botDmText() {
  return randomOf(BOT_DM_OPEN) + randomOf(BOT_DM_BODY) + randomOf(BOT_DM_TAIL);
}

let botTimers = [];
let botTickCount = 0;

function randomOf(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/* 一轮要做几条：取整并限制在 0..1000，防止设置过大一次刷爆 */
function botRoundCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(1000, Math.round(n));
}

function pickBotUser() {
  const index = 1 + Math.floor(Math.random() * BOT_MAX);
  return ensureBotUser(index);
}

/* 最近 100 条公开帖的 id，人机评论/点赞只在这些帖子上发生 */
function botPublicPostIds(limit = 100) {
  return db
    .prepare('SELECT id FROM posts WHERE private = 0 ORDER BY id DESC LIMIT ?')
    .all(limit)
    .map((r) => r.id);
}

/* 执行一轮：counts = { post, comment, like, dm }，各自表示本轮要做的条数 */
function botRound(counts) {
  counts = counts || {};
  botTickCount += 1;
  try {
    const postCount = botRoundCount(counts.post);
    for (let i = 0; i < postCount; i += 1) {
      try {
        const bot = pickBotUser();
        const id = createPost({
          userId: bot.id,
          text: botSentence(),
          private: false,
          sensitive: false,
          mediaIds: [],
          bot: true
        });
        addLog({
          type: 'bot', userId: bot.id, username: bot.username, ip: 'bot',
          detail: '人机发帖 #' + id + ' 作者 ' + (bot.nickname || bot.username)
        });
      } catch (e) {
        console.error('[人机] 发帖失败：' + (e && e.message));
      }
    }

    const commentCount = botRoundCount(counts.comment);
    if (commentCount > 0) {
      const ids = botPublicPostIds();
      for (let i = 0; i < commentCount && ids.length; i += 1) {
        try {
          const bot = pickBotUser();
          const postId = randomOf(ids);
          addComment(postId, bot.id, botCommentText(), undefined, true);
          addLog({
            type: 'bot', userId: bot.id, username: bot.username, ip: 'bot',
            detail: '人机评论 帖子 #' + postId
          });
        } catch (e) {
          console.error('[人机] 评论失败：' + (e && e.message));
        }
      }
    }

    const likeCount = botRoundCount(counts.like);
    if (likeCount > 0) {
      const ids = botPublicPostIds();
      for (let i = 0; i < likeCount && ids.length; i += 1) {
        try {
          const bot = pickBotUser();
          const postId = randomOf(ids);
          const liked = db.prepare('SELECT 1 AS x FROM likes WHERE post_id = ? AND user_id = ?').get(postId, bot.id);
          if (liked) continue; /* 已经点过就不再点，避免 toggle 掉 */
          toggleLike(postId, bot.id);
          addLog({
            type: 'bot', userId: bot.id, username: bot.username, ip: 'bot',
            detail: '人机点赞 帖子 #' + postId
          });
        } catch (e) {
          console.error('[人机] 点赞失败：' + (e && e.message));
        }
      }
    }
    /* 私信：给非人机的真实用户发一条随机话术；没有可发对象就整段跳过 */
    const dmCount = botRoundCount(counts.dm);
    if (dmCount > 0) {
      const targets = botDmTargets(20);
      for (let i = 0; i < dmCount && targets.length; i += 1) {
        try {
          const bot = pickBotUser();
          const target = randomOf(targets);
          if (!target || target.id === bot.id) continue;
          sendMessage(bot.id, target.id, botDmText());
          addLog({
            type: 'bot', userId: bot.id, username: bot.username, ip: 'bot',
            detail: '人机私信 -> 用户 ' + (target.nickname || target.username)
          });
        } catch (e) {
          console.error('[人机] 私信失败：' + (e && e.message));
        }
      }
    }
  } catch (e) {
    /* 任何异常都只记录，绝不 crash 服务 */
    console.error('[人机] tick 异常：' + (e && e.message));
  }
}

/* 设置变化后重建：每类动作一个定时器（每 EverySec 秒做 PerRound 条），全为 0 时不建 */
function restartBotEngine() {
  botTimers.forEach((t) => {
    try { clearInterval(t); } catch (e) { /* 已停止 */ }
  });
  botTimers = [];
  let cfg;
  try {
    cfg = getSettings();
  } catch (e) {
    console.error('[人机] 读取设置失败：' + (e && e.message));
    return;
  }
  const jobs = [
    { label: '发帖', key: 'post', every: cfg.botPostEverySec, round: cfg.botPostPerRound },
    { label: '评论', key: 'comment', every: cfg.botCommentEverySec, round: cfg.botCommentPerRound },
    { label: '点赞', key: 'like', every: cfg.botLikeEverySec, round: cfg.botLikePerRound },
    { label: '私信', key: 'dm', every: cfg.botDmEverySec, round: cfg.botDmPerRound }
  ].filter((j) => botRoundCount(j.round) > 0);
  if (!jobs.length) {
    console.log('[人机] 四类动作都是 0 条，引擎待机');
    return;
  }
  const started = [];
  jobs.forEach((j) => {
    const every = Math.min(3600, Math.max(1, Math.round(Number(j.every) || 20)));
    const round = botRoundCount(j.round);
    const payload = { post: 0, comment: 0, like: 0, dm: 0 };
    payload[j.key] = round;
    const timer = setInterval(() => {
      try {
        botRound(payload);
      } catch (e) {
        console.error('[人机] ' + j.label + ' 异常：' + (e && e.message));
      }
    }, every * 1000);
    if (timer.unref) timer.unref();
    botTimers.push(timer);
    started.push(j.label + ' 每 ' + every + ' 秒 ' + round + ' 条');
  });
  console.log('[人机] 引擎已启动（' + started.join('；') + '）');
}

const server = http.createServer((req, res) => {
  /* 请求/响应流错误（手机切网络、中断上传下载）必须吞掉，否则会直接结束进程 */
  req.on('error', () => {
    try { res.destroy(); } catch (e) { /* 已断开 */ }
  });
  res.on('error', () => {});
  route(req, res).catch((err) => {
    if (res.headersSent) {
      try {
        res.end();
      } catch (e) {
        /* 忽略 */
      }
      return;
    }
    json(res, 400, { error: err.message || '请求失败' });
  });
});

/* 客户端提前断开连接（视频拖动进度条、切页）不应该让服务器退出 */
server.on('clientError', (err, socket) => {
  try { socket.destroy(); } catch (e) { /* 已关闭 */ }
});

/* 兜底：任何漏网的异常只记录日志，保持服务器继续运行 */
process.on('uncaughtException', (err) => {
  console.error('[未捕获异常] ' + (err && err.message ? err.message : err));
});
process.on('unhandledRejection', (err) => {
  console.error('[未处理的 Promise] ' + (err && err.message ? err.message : err));
});

server.listen(PORT, HOST, () => {
  listenPort = server.address().port;
  const lan = lanAddresses();
  const lanUrls = lan.map((a) => 'http://' + a.address + ':' + listenPort);
  const lines = [
    '',
    '==================================================',
    '  U 后台服务器已启动',
    '==================================================',
    '  管理后台:  http://127.0.0.1:' + listenPort + '/admin',
    '  手机打开:  ' + (lanUrls.length ? lanUrls[0] + '/admin' : '未检测到局域网地址'),
    '  手机自检:  ' + (lanUrls.length ? lanUrls[0] + '/check' : 'http://电脑局域网IP:' + listenPort + '/check'),
    '             （手机浏览器打开，显示「服务器在线」说明网络已通）',
    '',
    '  App 设置 → 后台服务器地址 填:',
    '  ' + (lanUrls.length ? lanUrls[0] : 'http://电脑局域网IP:' + listenPort),
    '',
    '  管理台账号:  ' + (process.env.ADMIN_USER || 'admin123') + ' / ' + (process.env.ADMIN_PASS || 'admin123'),
    '  数据目录:    ' + DATA_DIR + '  (' + ({ env: '来自环境变量 U_DATA_DIR', config: '来自 data-dir.json', default: '默认目录' }[DATA_INFO.source] || DATA_INFO.source) + ')',
    '  上传目录:    ' + MEDIA_DIR,
    '  数据配置:    ' + DATA_DIR_FILE,
    '  自动发现:    UDP ' + DISCOVER_PORT + '（App 进来自动找服务器，无需手填地址）',
    '',
    '  Windows 首次运行请在弹出的防火墙窗口点「允许访问」。',
    '  手机仍打不开时，用管理员 CMD 执行：',
    '  netsh advfirewall firewall add rule name="U Server" dir=in action=allow protocol=TCP localport=' + listenPort,
    '--------------------------------------------------',
    '  保持这个窗口打开，关闭窗口 = 服务器停止',
    ''
  ];
  console.log(lines.join('\n'));
  startDiscoveryResponder();
  restartBotEngine();
  /* 自动备份：启动时检查一次，之后每小时检查（间隔与保留份数在 settings 里） */
  autoBackupTick();
  setInterval(autoBackupTick, 60 * 60 * 1000);
});

/* ---------------- 局域网自动发现：UDP 应答 ----------------
   App 端往 255.255.255.255:8788 广播 "U?"，本机收到就回一段 JSON，
   App 从报文来源地址直接拿到服务器 IP，免去扫描整个网段。 */
let discoverSocket = null;
function startDiscoveryResponder() {
  if (discoverSocket) return;
  let sock;
  try {
    sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  } catch (e) {
    return;
  }
  sock.on('error', (err) => {
    console.log('[发现服务] UDP ' + DISCOVER_PORT + ' 不可用（' + (err && err.code) + '），App 会改用端口扫描发现服务器');
    try { sock.close(); } catch (e) { /* ignore */ }
    discoverSocket = null;
  });
  sock.on('message', (msg, rinfo) => {
    const q = String(msg || '').trim();
    if (q && q.length > 40) return;
    let payload;
    try {
      payload = Buffer.from(JSON.stringify({
        ok: true,
        app: 'U',
        api: 1,
        port: listenPort,
        name: os.hostname(),
        lan: lanAddresses().map((a) => 'http://' + a.address + ':' + listenPort)
      }));
    } catch (e) {
      return;
    }
    try {
      sock.send(payload, 0, payload.length, rinfo.port, rinfo.address);
    } catch (e) { /* ignore */ }
  });
  try {
    sock.bind(DISCOVER_PORT, () => {
      discoverSocket = sock;
      try { sock.setBroadcast(true); } catch (e) { /* ignore */ }
    });
  } catch (e) {
    try { sock.close(); } catch (e2) { /* ignore */ }
  }
}

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    if (listenPort - PORT < 5) {
      console.log('端口 ' + listenPort + ' 被占用，尝试 ' + (listenPort + 1) + ' …');
      listenPort += 1;
      server.listen(listenPort, HOST);
      return;
    }
    console.error('\n[启动失败] 端口 ' + PORT + '-' + listenPort + ' 都被占用。');
    console.error('请关闭占用端口的程序，或用 PORT=9000 npm start 换一个端口。\n');
    process.exit(1);
  }
  console.error('\n[启动失败] ' + (err && err.message ? err.message : err));
  process.exit(1);
});

function shutdown() {
  try { if (discoverSocket) discoverSocket.close(); } catch (e) { /* ignore */ }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
