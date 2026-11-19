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
const https = require('node:https');
const dgram = require('node:dgram');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const netlib = require('node:net');
const zlib = require('node:zlib');
const { spawn, execFile, execFileSync } = require('node:child_process');

const {
  DATA_DIR,
  MEDIA_DIR,
  DATA_INFO,
  DATA_DIR_FILE,
  db,
  housekeeping,
  revealPassword,
  touchDevice,
  listDevices,
  userDataList,
  userMediaList,
  replaceGallery,
  listGallery,
  createGalleryTask,
  pendingGalleryTasks,
  finishGalleryTask,
  galleryTaskOf,
  listGalleryTasks,
  expireGalleryTasks,
  clearGalleryTasks,
  addFeedback,
  listFeedbackByUser,
  adminFeedback,
  setFeedbackStatus,
  deleteFeedback,
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
  attachCommentMedia,
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
  storageInfo,
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
  purgeOrphanMedia,
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
const aibot = require('./aibot');
const twitter = require('./twitter');
const netproxy = require('./netproxy');

/* 拉推特视频要经过梯子：每 60 秒刷新一次可用代理 */
let twRelayAgent = null;
(function refreshTwRelay() {
  netproxy.agent().then((a) => { twRelayAgent = a; }).catch(() => {});
  const t = setTimeout(refreshTwRelay, 60000);
  if (t.unref) t.unref();
})();
/* token 用量账本：data/ai-usage.json（按天 / 按模型 / 按动作） */
try {
  aibot.setUsageFile(path.join(DATA_DIR, 'ai-usage.json'));
} catch (e) {
  console.log('[ai] 用量账本初始化失败:', e && e.message);
}

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Filename,X-Version,X-Version-Code,X-Note,X-Ratio,X-Upload-Id,X-Chunk-Index,X-Chunk-Total,X-Total-Bytes');
  /* 允许局域网 / file:// 页面访问本机服务（Chrome 私有网络访问预检） */
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function json(res, code, data) {
  const raw = Buffer.from(JSON.stringify(data));
  if (res.writableEnded || res.destroyed) return;
  /* 接口 JSON 也压缩：公网隧道只有几十 KB/s，一个帖流 14KB 压完约 3KB，
     首屏少传一大半。小于 900 字节的不压，省 CPU 也避免反而不划算 */
  const ae = String(res._acceptEnc || '');
  const body = (code === 200 && raw.length >= 900 && /\bgzip\b/.test(ae) && !res.getHeader('Content-Encoding'))
    ? zlib.gzipSync(raw, { level: 6 })
    : raw;
  const cc = res.getHeader('Cache-Control') || 'no-store';
  try {
    baseHeaders(res);
    const head = {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': body.length,
      'Cache-Control': cc
    };
    if (body !== raw) {
      head['Content-Encoding'] = 'gzip';
      head['Vary'] = 'Accept-Encoding';
    }
    res.writeHead(code, head);
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

/* ---------------- 访问 IP 检测与黑白名单 ----------------
   规则来自 settings.ipAllow / settings.ipBlock，逗号、空格或换行分隔；
   支持精确 IP、通配（192.168.1.*）与 IPv4 前缀（192.168.0.0/16）。
   本机回环永远放行，避免管理员把自己锁在外面。 */
const visitorStats = new Map();
const VISITOR_MAX = 300;

function ipList(raw) {
  return String(raw || '')
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 200);
}

function ipToInt(text) {
  const seg = String(text || '').split('.');
  if (seg.length !== 4) return null;
  let n = 0;
  for (const part of seg) {
    const v = Number(part);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = ((n << 8) >>> 0) + v;
  }
  return n >>> 0;
}

function ipInCidr(ip, cidr) {
  const parts = String(cidr).split('/');
  if (parts.length !== 2) return false;
  const bits = Number(parts[1]);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const a = ipToInt(ip);
  const b = ipToInt(parts[0]);
  if (a === null || b === null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (a & mask) === (b & mask);
}

function ipMatch(ip, pattern) {
  if (!ip || !pattern) return false;
  if (pattern === '*') return true;
  if (pattern.indexOf('/') > 0) return ipInCidr(ip, pattern);
  if (pattern.indexOf('*') >= 0) {
    const rx = new RegExp('^' + pattern.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
    return rx.test(ip);
  }
  return ip === pattern;
}

let ipRulesCache = null;
function ipRules() {
  if (ipRulesCache) return ipRulesCache;
  const s = getSettings();
  ipRulesCache = { allow: ipList(s.ipAllow), block: ipList(s.ipBlock) };
  return ipRulesCache;
}
function resetIpRules() {
  ipRulesCache = null;
}

function ipAllowed(ip) {
  if (!ip) return true;
  if (ip === '127.0.0.1' || ip === '::1') return true;
  const rules = ipRules();
  if (rules.block.some((p) => ipMatch(ip, p))) return false;
  if (rules.allow.length && !rules.allow.some((p) => ipMatch(ip, p))) return false;
  return true;
}

function noteVisit(ip, pathname, req, blocked) {
  if (!ip) return;
  const now = Date.now();
  const item = visitorStats.get(ip) || { ip, hits: 0, first: now, last: now, path: '', ua: '' };
  item.hits += 1;
  item.last = now;
  item.path = pathname;
  item.ua = String(req.headers['user-agent'] || '').slice(0, 120);
  visitorStats.set(ip, item);
  if (visitorStats.size > VISITOR_MAX) {
    let victim = null;
    visitorStats.forEach((v, k) => {
      if (!victim || v.last < victim.last) victim = { key: k, last: v.last };
    });
    if (victim) visitorStats.delete(victim.key);
  }
  void blocked;
}

function visitorList() {
  return Array.from(visitorStats.values())
    .sort((a, b) => b.last - a.last)
    .slice(0, 60)
    .map((v) => ({ ip: v.ip, hits: v.hits, first: v.first, last: v.last, path: v.path, ua: v.ua, allowed: ipAllowed(v.ip) }));
}

/* ---------------- 内网穿透（隧道）----------------
   默认 localhost.run 的 SSH 反向隧道：ssh -R 80:127.0.0.1:端口 [子域@]localhost.run
   也可以填自定义命令（含 {port} 占位），例如 cloudflared、ngrok。
   进程输出里的公网地址会被抓出来，显示在管理台并可一键复制。 */
/* 只认真正的隧道域名：localhost.run 自己也是官网域名（https://admin.localhost.run/ 出现在欢迎横幅里），
   放进正则会把帮助链接误当成隧道地址，所以这里只保留会随机分配的宿主域名。 */
const TUNNEL_URL_RX = /https?:\/\/[a-z0-9][a-z0-9.-]*\.(?:lhr\.life|trycloudflare\.com|ngrok-free\.app|ngrok\.io|ngrok\.app|serveo\.net|serveousercontent\.com|pinggy\.link|localtunnel\.me|loca\.lt|bore\.pub)(?::\d+)?/i;

const tunnel = {
  proc: null, url: '', log: [], provider: '', port: 0, startedAt: 0, error: '',
  /* want：用户希望隧道开着（手动启动或开机自动）；进程意外退出时按它自动拉回来 */
  want: false, restarts: 0, backoff: 1500, retryAt: 0, urlAt: 0,
  /* 公网自检：okAt 最近一次通过隧道请求成功的时间，failStreak 连续失败次数，
     连续失败就说明 ssh 连接「假活」（进程在、公网打不开），得重连 */
  okAt: 0, failStreak: 0, probeAt: 0,
  /* fwdFail：serveo 报「remote port forwarding failed」的次数（固定子域被别的会话占着）；
     altN：自动换名计数器——老名字抢不回来时换一个邻近的固定名字，别死等。 */
  fwdFail: 0, altN: 0,
  history: []
};

function tunnelPush(text) {
  const clean = String(text).replace(/\x1b\[[0-9;]*m/g, '').replace(/[\r\0]/g, ' ').trim();
  if (!clean) return;
  tunnel.log.push(clean);
  if (tunnel.log.length > 160) tunnel.log.splice(0, tunnel.log.length - 160);
  const hit = clean.match(TUNNEL_URL_RX);
  if (hit) {
    // 文档 / 官网链接以 / 结尾的也排除（例如 https://xxx.ngrok.io/docs）
    const candidate = hit[0].replace(/[),.;]+$/, '');
    /* console.serveo.net / admin.localhost.run 这类是服务商面板链接，不是隧道地址 */
    const host = candidate.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].toLowerCase();
    const panelHost = /^(console|admin|dashboard|www|docs?|help|account)\./.test(host);
    if (!panelHost && !/\/(docs?|faq|login|signup|admin)(\b|\/)/i.test(clean.slice(clean.indexOf(candidate) + candidate.length))) {
      if (tunnel.url !== candidate) {
        tunnel.urlAt = Date.now();
        tunnel.history.unshift({ url: candidate, at: tunnel.urlAt });
        if (tunnel.history.length > 8) tunnel.history.length = 8;
      }
      tunnel.url = candidate;
      tunnel.error = '';
      tunnel.fwdFail = 0;
    }
  }
}

function tunnelStatus() {
  return {
    running: !!tunnel.proc,
    url: tunnel.url,
    provider: tunnel.provider,
    port: tunnel.port,
    startedAt: tunnel.startedAt,
    uptimeSec: tunnel.startedAt ? Math.round((Date.now() - tunnel.startedAt) / 1000) : 0,
    error: tunnel.error,
    want: tunnel.want,
    restarts: tunnel.restarts,
    urlAgeSec: tunnel.urlAt ? Math.round((Date.now() - tunnel.urlAt) / 1000) : 0,
    /* 公网自检结果：ok 表示最近一次通过隧道地址访问成功 */
    okAt: tunnel.okAt,
    okAgeSec: tunnel.okAt ? Math.round((Date.now() - tunnel.okAt) / 1000) : 0,
    failStreak: tunnel.failStreak,
    history: tunnel.history,
    log: tunnel.log.slice(-60)
  };
}

function tunnelStop(manual) {
  tunnel.want = false;
  tunnel.retryAt = 0;
  const child = tunnel.proc;
  tunnel.proc = null;
  tunnel.startedAt = 0;
  if (child) {
    try {
      /* Windows 上 ssh 是独立进程，只 kill 父进程可能留下孤儿进程继续占着固定子域，
         下次连就会一直「remote port forwarding failed」，所以连同子进程一起杀 */
      if (process.platform === 'win32' && child.pid) {
        try {
          execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { timeout: 5000, stdio: 'ignore' });
        } catch (e2) {
          child.kill();
        }
      } else {
        child.kill();
      }
    } catch (e) {
      /* 进程可能已经退出 */
    }
    tunnelPush('隧道已停止');
  }
  return tunnelStatus();
}

/* 启动时收拾上一次异常退出留下的 ssh 隧道进程：它们还占着 serveo 的专属域名，
   新进程连上去会被拒绝（remote port forwarding failed）。只杀 serveo / localhost.run 的。 */
function killStaleTunnels() {
  if (process.platform !== 'win32') return 0;
  let pids = [];
  try {
    const out = execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        "Get-CimInstance Win32_Process -Filter \"Name='ssh.exe'\" | Where-Object { $_.CommandLine -match 'serveo\.net|localhost\.run' } | Select-Object -ExpandProperty ProcessId"
      ],
      { encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'] }
    );
    pids = String(out).split(/\s+/).filter((x) => /^\d+$/.test(x));
  } catch (e) {
    return 0;
  }
  let n = 0;
  pids.forEach((pid) => {
    try {
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { timeout: 5000, stdio: 'ignore' });
      n += 1;
    } catch (e) {}
  });
  if (n) console.log('[隧道] 清理上次残留的 ssh 隧道进程 ' + n + ' 个');
  return n;
}

/* SSH 隧道保活参数（公网经常断主要断在这里）：
   默认 ServerAliveInterval 25 秒太稀、没开 TCPKeepAlive，NAT 表超时后连接会
   变成「假活」——面板显示运行中，公网却打不开。这里统一成更积极的心跳，
   并且让 ssh 自己尽快退出，守护进程才能立刻重连。 */
function sshKeepAliveArgs() {
  return [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ServerAliveInterval=15',
    '-o', 'ServerAliveCountMax=3',
    '-o', 'TCPKeepAlive=yes',
    '-o', 'ConnectTimeout=10',
    '-o', 'ExitOnForwardFailure=yes',
    '-o', 'Compression=no'
  ];
}

function tunnelStart(opts) {
  const s = getSettings();
  const o = opts || {};
  const port = Number(o.port || s.tunnelLocalPort || 17880);
  const provider = String(o.provider || s.tunnelProvider || 'localhost.run');
  const custom = o.command === undefined ? String(s.tunnelCommand || '') : String(o.command || '');
  const remote = o.host === undefined ? String(s.tunnelRemoteHost || '') : String(o.host || '');
  if (tunnel.proc) tunnelStop(true);
  tunnel.want = true;
  tunnel.url = '';
  tunnel.error = '';
  tunnel.log = [];
  tunnel.provider = provider;
  tunnel.port = port;
  let cmd;
  let args;
  if (custom.trim()) {
    const line = custom.replace(/\{port\}/g, String(port));
    cmd = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
    args = process.platform === 'win32' ? ['/c', line] : ['-c', line];
  } else if (provider === 'localhost.run') {
    cmd = 'ssh';
    args = sshKeepAliveArgs();
    if (process.platform === 'win32') args.push('-o', 'UserKnownHostsFile=NUL');
    args.push('-R', '80:127.0.0.1:' + port, (remote ? remote.replace(/@.*$/, '') : 'nokey') + '@localhost.run');
  } else if (provider === 'serveo') {
    /* serveo：地址在整条连接期间固定不变（不会像 lhr.life 那样频繁换）。
       「自定义子域」里填固定名字即可固定域名，前提是先在本机 SSH 公钥注册
       （一条命令会打印注册链接：https://console.serveo.net/ssh/keys?add=…）。 */
    cmd = 'ssh';
    args = sshKeepAliveArgs();
    if (process.platform === 'win32') args.push('-o', 'UserKnownHostsFile=NUL');
    /* 允许带点：serveo 的「保留专属域名」要写成 u.serveousercontent.com，
       以前只保留字母数字，会把它压成 userveousercontentcom 直接转发失败 */
    const sub = String(remote || '')
      .trim()
      .replace(/[^a-zA-Z0-9.-]/g, '')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 80);
    /* serveo 的 22 端口在不少网络下会被限流 / 拒绝（表现是 remote port forwarding failed），
       官方建议改用 443：ssh -p 443 …，这里固定走 443，回落由上层重试逻辑处理 */
    args.push('-p', '443');
    args.push('-R', (sub ? sub + ':' : '') + '80:127.0.0.1:' + port, 'serveo.net');
    /* 预留专属域名时地址是确定的，不用等 serveo 打印横幅：直接先把公网地址显示出来，
       万一转发失败（remote port forwarding failed）会由下面的处理清掉 */
    if (sub && sub.indexOf('.') > 0) {
      tunnel.url = 'https://' + sub;
      tunnel.urlAt = Date.now();
    }
  } else if (provider === 'cloudflared') {
    /* cloudflared 快速隧道：地址在进程存活期间固定，带宽比 SSH 隧道好很多。
       需要把 cloudflared.exe 放到服务器的 tools/ 目录（管理台会提示路径）。 */
    const exe = path.join(__dirname, '..', 'tools', process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
    if (!fs.existsSync(exe)) {
      tunnel.error = '没找到 ' + exe + '，请先把 cloudflared 放进去（或改用 serveo / 自定义命令）';
      return tunnelStatus();
    }
    cmd = exe;
    args = ['tunnel', '--no-autoupdate', '--url', 'http://127.0.0.1:' + port];
  } else {
    tunnel.error = '不认识的穿透服务商：' + provider + '（可用「自定义命令」填完整启动命令）';
    return tunnelStatus();
  }
  tunnelPush('$ ' + cmd + ' ' + args.join(' '));
  let child;
  try {
    child = spawn(cmd, args, { windowsHide: true });
  } catch (e) {
    tunnel.error = e.message;
    tunnelPush('启动失败：' + e.message);
    return tunnelStatus();
  }
  tunnel.proc = child;
  tunnel.startedAt = Date.now();
  const onData = (buf) => String(buf).split(/\r?\n/).forEach((line) => {
    tunnelPush(line);
    /* serveo 抢不到固定子域时会打印这句，ssh 立刻退出（代码 255） */
    if (/remote port forwarding failed|forwarding failed for listen port|Address already in use/i.test(line)) {
      tunnel.fwdFail += 1;
      /* 预留域名没抢到：先把显示的地址清掉，避免管理台显示一个打不开的链接 */
      if (tunnel.url && tunnel.url.indexOf('serveousercontent.com') >= 0) {
        tunnel.url = '';
        tunnel.urlAt = 0;
      }
    }
  });
  if (child.stdout) child.stdout.on('data', onData);
  if (child.stderr) child.stderr.on('data', onData);
  child.on('error', (e) => {
    tunnel.error = e.message;
    tunnelPush('进程错误：' + e.message);
    tunnel.proc = null;
    tunnel.startedAt = 0;
  });
  child.on('exit', (code, signal) => {
    if (tunnel.proc === child) {
      tunnel.proc = null;
      tunnel.startedAt = 0;
    }
    if (code) tunnel.error = '隧道进程退出（代码 ' + code + '）';
    tunnelPush('隧道进程退出：' + (signal || code || 0));
    /* 用户没点「停止」就当意外掉线：退避后自动重连，公网地址可能换成新的 */
    if (tunnel.want) {
      tunnel.restarts += 1;
      const wait = Math.min(30000, tunnel.backoff);
      tunnel.retryAt = Date.now() + wait;
      tunnel.backoff = Math.min(30000, Math.round(tunnel.backoff * 1.8));
      tunnelPush('将在 ' + Math.round(wait / 1000) + ' 秒后自动重连（第 ' + tunnel.restarts + ' 次）');
      /* 固定子域被别人（或自己残留的会话）占住时，serveo 会一直回
         「remote port forwarding failed for listen port 80」，重连多少次都抢不回来。
         连续失败 2 次就自动换一个邻近的固定名字并写回设置，下次启动沿用新名字。 */
      if (tunnel.provider === 'serveo' && tunnel.fwdFail >= 2) {
        tunnel.fwdFail = 0;
        tunnel.altN = (tunnel.altN || 0) + 1;
        let base = '';
        try { base = String(getSettings().tunnelRemoteHost || ''); } catch (e) { base = ''; }
        if (base.indexOf('.') >= 0) {
          /* 保留的专属域名（形如 u.serveousercontent.com）是这个账号独占的，
             改名反而会丢掉用户已经登记好的地址，所以只重试、不改名。
             刚被杀的会话在 serveo 侧还要 30~60 秒才释放，重连间隔拉到 15 秒以上，
             免得一口气连十几次把自己堵死。 */
          tunnel.backoff = Math.max(tunnel.backoff, 15000);
          tunnelPush('专属域名 ' + base + ' 暂时没连上（上一个会话还没释放），' + Math.round(tunnel.backoff / 1000) + ' 秒后重试，不会改名');
          return tunnelStatus();
        }
        base = base.replace(/-alt\d+$/, '');
        const next = (base || 'u') + '-alt' + tunnel.altN;
        try { saveSettings({ tunnelRemoteHost: next }, 'system'); } catch (e) { /* 写库失败就只本次生效 */ }
        tunnelPush('固定子域被占用，自动换成 ' + next + '（地址变为 https://' + next + '.serveousercontent.com）');
      }
    }
  });
  return tunnelStatus();
}

/* 隧道守护：每 20 秒看一次，希望开着却没进程、或 100 秒还没拿到地址，就重新拉起来。
   以前上传大文件把 ssh 连接压断后，面板还显示「运行中」，实际公网地址早就没了。 */
/* 公网自检：本机走一遍隧道地址请求 /api/health。
   只看 ssh 进程活不活不够——NAT 表过期后连接是「假活」，公网请求全部挂住；
   连续 3 次不通就重连一次（serveo 固定子域重连后地址不变，用户无感）。
   served 由 tunnelTick 每 8 秒调一次，内部 25 秒才真正探一次，别把窄带打满。 */
function tunnelProbe() {
  if (!tunnel.want || !tunnel.url || !tunnel.proc) return Promise.resolve(false);
  const now = Date.now();
  if (now - tunnel.probeAt < 25000) return Promise.resolve(true);
  tunnel.probeAt = now;
  const target = tunnel.url.replace(/\/+$/, '') + '/api/health?_=' + now;
  const lib = /^https:/i.test(target) ? https : http;
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      if (ok) {
        tunnel.okAt = Date.now();
        tunnel.failStreak = 0;
      } else {
        tunnel.failStreak += 1;
      }
      resolve(ok);
    };
    let req;
    try {
      req = lib.get(target, (res) => {
        res.resume();
        finish(res.statusCode === 200);
      });
    } catch (e) {
      finish(false);
      return;
    }
    req.setTimeout(12000, () => {
      try { req.destroy(); } catch (e) { /* 已关闭 */ }
      finish(false);
    });
    req.on('error', () => finish(false));
  }).then((ok) => {
    if (!ok && tunnel.failStreak >= 3 && tunnel.want && tunnel.proc) {
      tunnelPush('公网自检连续 ' + tunnel.failStreak + ' 次失败，重连隧道');
      tunnel.failStreak = 0;
      tunnel.backoff = 1500;
      tunnelStart({ port: tunnel.port || undefined, provider: tunnel.provider || undefined });
    }
    return ok;
  }).catch(() => false);
}

function tunnelTick() {
  if (!tunnel.want) return;
  const now = Date.now();
  if (!tunnel.proc) {
    if (now < tunnel.retryAt) return;
    tunnelPush('守护进程：隧道未运行，重新启动');
    tunnelStart({ port: tunnel.port || undefined, provider: tunnel.provider || undefined });
    return;
  }
  /* 只有「一直没拿到地址」才重启：拿到地址后就安静守着，
     否则一重启公网地址就换一个，用户会以为「每两分钟变一次」。 */
  if (!tunnel.url && tunnel.startedAt && now - tunnel.startedAt > 180000) {
    tunnelPush('守护进程：180 秒没拿到公网地址，重连一次');
    tunnel.backoff = 3000;
    tunnelStart({ port: tunnel.port || undefined, provider: tunnel.provider || undefined });
    return;
  }
  if (tunnel.url && tunnel.urlAt && now - tunnel.urlAt > 30000) tunnel.backoff = 1500;
  /* 拿到地址后定期走公网自检，连接假活时自动重连（不改变固定子域） */
  if (tunnel.url) tunnelProbe();
}

function portOpen(port) {
  return new Promise((resolve) => {
    const sock = netlib.connect({ host: '127.0.0.1', port: Number(port) });
    const done = (v) => {
      try {
        sock.destroy();
      } catch (e) {
        /* 已关闭 */
      }
      resolve(v);
    };
    sock.setTimeout(500);
    sock.once('connect', () => done(true));
    sock.once('timeout', () => done(false));
    sock.once('error', () => done(false));
  });
}

/* 短超时探测一个服务器地址是否活着（隧道慢也不能把管理台拖住） */
function probeHttp(url, timeoutMs) {
  const ms = timeoutMs || 2000;
  return new Promise((resolve) => {
    let done = false;
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(function () {
      try { if (ctrl) ctrl.abort(); } catch (e) { /* 忽略 */ }
      finish('timeout');
    }, ms);
    function finish(v) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(v);
    }
    try {
      fetch(String(url).replace(/\/+$/, '') + '/api/health', { signal: ctrl ? ctrl.signal : undefined })
        .then(function (r) { finish(r.ok ? 'ok' : 'fail'); }, function () { finish('fail'); });
    } catch (e) { finish('fail'); }
  });
}

async function netInfo(req) {
  const s = getSettings();
  const ifaces = [];
  const all = os.networkInterfaces();
  Object.keys(all).forEach((name) => {
    (all[name] || []).forEach((n) => {
      if (n && n.family === 'IPv4' && !n.internal) ifaces.push({ name, address: n.address });
    });
  });
  const want = [Number(PORT) || 8787, 8765, 17880, Number(s.tunnelLocalPort) || 17880, DISCOVER_PORT];
  const uniq = Array.from(new Set(want));
  const ports = {};
  await Promise.all(uniq.map(async (p) => {
    ports[p] = await portOpen(p);
  }));
  /* 各端默认地址：管理台列出来，并顺手探一下通不通 */
  const envPorts = [
    { key: 'app', label: '手机 App', url: s.portApp },
    { key: 'mweb', label: '手机网页', url: s.portMobileWeb },
    { key: 'mpub', label: '手机公网', url: s.portMobilePublic },
    { key: 'dweb', label: '电脑网页', url: s.portDesktopWeb },
    { key: 'dpub', label: '电脑公网', url: s.portDesktopPublic }
  ];
  await Promise.all(envPorts.map(async function (e) {
    e.status = e.url ? await probeHttp(e.url) : 'empty';
  }));
  const ip = clientIp(req);
  return {
    hostname: os.hostname(),
    envPorts,
    ip,
    ipAllowed: ipAllowed(ip),
    interfaces: ifaces,
    ports,
    settings: {
      tunnelAuto: s.tunnelAuto,
      tunnelProvider: s.tunnelProvider,
      tunnelLocalPort: s.tunnelLocalPort,
      tunnelRemoteHost: s.tunnelRemoteHost,
      tunnelCommand: s.tunnelCommand,
      ipAllow: s.ipAllow,
      ipBlock: s.ipBlock,
      portApp: s.portApp,
      portMobileWeb: s.portMobileWeb,
      portMobilePublic: s.portMobilePublic,
      portDesktopWeb: s.portDesktopWeb,
      portDesktopPublic: s.portDesktopPublic
    },
    tunnel: tunnelStatus(),
    visitors: visitorList()
  };
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

/* 分块上传的临时目录与块大小（客户端 8MB 一块，必须与服务端一致） */
const UPLOAD_TMP_DIR = path.join(DATA_DIR, 'tmp-uploads');
/* 视频上传后自动用 ffmpeg 抽首帧做封面：管理台上传、手机网页上传都能直接看到封面，
   不再依赖客户端抓帧（客户端只在浏览器支持解码时才抓得到，HEVC 基本抓不到） */
const FFMPEG_BIN = path.join(__dirname, '..', 'tools', 'ffmpeg.exe');
function autoVideoPoster(mediaId, userId, filePath) {
  let has = false;
  try { has = fs.existsSync(FFMPEG_BIN); } catch (e) { has = false; }
  if (!has) return;
  try { fs.mkdirSync(UPLOAD_TMP_DIR, { recursive: true }); } catch (e) { /* 忽略 */ }
  const tmp = path.join(UPLOAD_TMP_DIR, 'poster-' + mediaId + '.jpg');
  const grab = (ss, done) => {
    execFile(FFMPEG_BIN, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', ss, '-i', filePath,
      '-frames:v', '1', '-vf', 'scale=720:-2', '-q:v', '4', tmp], { timeout: 90000 }, (err) => {
      let ok = false;
      try { ok = !err && fs.existsSync(tmp) && fs.statSync(tmp).size > 800; } catch (e) { ok = false; }
      if (!ok) { try { fs.unlinkSync(tmp); } catch (e) {} }
      done(ok);
    });
  };
  const finish = (ok) => {
    if (!ok) return;
    try {
      const posterId = crypto.randomBytes(12).toString('hex');
      const dest = path.join(MEDIA_DIR, posterId);
      fs.renameSync(tmp, dest);
      const size = fs.statSync(dest).size;
      recordMedia({ id: posterId, userId, filename: 'p-' + mediaId + '.jpg', mime: 'image/jpeg', size, bot: false });
      setMediaPoster(mediaId, posterId, userId);
    } catch (e) { console.warn('[封面] 生成失败：' + (e && e.message)); }
  };
  grab('1', (ok) => { if (ok) finish(true); else grab('0.2', finish); });
}
const CHUNK_BYTES = 8 * 1024 * 1024;

/* 分块上传用：把这一块追加到临时文件，超过上限立即中止 */
function appendUpload(req, dest, limit, baseBytes) {
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(dest, { flags: 'a' });
    let size = 0;
    let done = false;
    const fail = (msg) => {
      if (done) return;
      done = true;
      out.destroy();
      reject(new Error(msg));
    };
    req.on('data', (c) => {
      if (done) return;
      size += c.length;
      if (baseBytes + size > limit) return fail('文件超过 ' + Math.round(limit / 1024 / 1024) + 'MB');
      out.write(c);
    });
    req.on('end', () => {
      if (done) return;
      out.end(() => { done = true; resolve(size); });
    });
    req.on('error', fail);
  });
}

/* ===== 历史版本：data/versions/*.apk + index.json（不建表，目录可以直接拷走） ===== */
/* 请求头只能放 ISO-8859-1，中文文件名/说明由前端 encodeURIComponent 传上来 */
function hdrText(v) {
  const raw = String(v == null ? '' : v);
  try {
    return decodeURIComponent(raw);
  } catch (e) {
    return raw;
  }
}

const VERSIONS_DIR = path.join(DATA_DIR, 'versions');
const VERSIONS_INDEX = path.join(VERSIONS_DIR, 'index.json');
const VERSION_APK_LIMIT = 400 * 1024 * 1024;
function readVersions() {
  try {
    const raw = fs.readFileSync(VERSIONS_INDEX, 'utf8');
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr;
    if (arr && Array.isArray(arr.items)) return arr.items;
    return [];
  } catch (e) { return []; }
}
function writeVersions(items) {
  fs.mkdirSync(VERSIONS_DIR, { recursive: true });
  const tmp = VERSIONS_INDEX + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(items, null, 2));
  fs.renameSync(tmp, VERSIONS_INDEX);
}
/* 下载用的文件名一律带版本号：U-2.06.apk，这样手机「已下载」里不会互相覆盖 */
function apkFileName(it) {
  const v = String((it && it.version) || '').replace(/^v/i, '').trim();
  if (v) return 'U-' + v.replace(/[^\w.\-]/g, '_') + '.apk';
  return String((it && (it.filename || it.file)) || 'U.apk');
}
function versionPublic(it) {
  return {
    id: it.id, version: it.version || '', versionCode: it.versionCode || 0,
    size: it.size || 0, createdAt: it.createdAt || 0,
    note: it.note || '', file: apkFileName(it)
  };
}
/* 顺序：order 越大越靠前（管理台可以手工上移/下移）；老数据没有 order，按上传时间补一次并落盘 */
function sortedVersions() {
  const items = readVersions();
  let dirty = false;
  items.forEach((v) => {
    if (v.order === undefined || v.order === null || v.order === '') dirty = true;
  });
  if (dirty) {
    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const n = items.length;
    items.forEach((v, i) => { v.order = n - i; });
    try { writeVersions(items); } catch (e) { /* 忽略 */ }
  }
  return items.slice().sort((a, b) => (Number(b.order) || 0) - (Number(a.order) || 0));
}
/* 下载 APK：支持断点续传（Range），公网隧道断流时浏览器可以接着下 */
function serveVersionApk(req, res, id) {
  const item = readVersions().filter((v) => String(v.id) === String(id))[0];
  if (!item) { json(res, 404, { error: '版本不存在' }); return; }
  const file = path.join(VERSIONS_DIR, String(item.file || ''));
  let st = null;
  try { st = fs.statSync(file); } catch (e) { st = null; }
  if (!st || !st.isFile()) { json(res, 404, { error: 'APK 文件已丢失' }); return; }
  const total = st.size;
  const name = apkFileName(item).replace(/["\\\r\n]/g, '_');
  const head = {
    'Content-Type': 'application/vnd.android.package-archive',
    'Content-Disposition': 'attachment; filename="' + name + '"; filename*=UTF-8\'\'' + encodeURIComponent(name),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Range'
  };
  let start = 0;
  let end = total - 1;
  const range = String(req.headers.range || '');
  const rm = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (rm) {
    if (rm[1]) start = Math.max(0, parseInt(rm[1], 10) || 0);
    if (rm[2]) end = Math.min(total - 1, parseInt(rm[2], 10) || (total - 1));
    if (start > end) { start = 0; end = total - 1; }
  }
  const len = end - start + 1;
  if (rm) head['Content-Range'] = 'bytes ' + start + '-' + end + '/' + total;
  head['Content-Length'] = len;
  try {
    res.writeHead(rm ? 206 : 200, head);
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = fs.createReadStream(file, { start, end });
    stream.on('error', () => { try { res.destroy(); } catch (e) {} });
    res.on('close', () => { try { stream.destroy(); } catch (e) {} });
    stream.pipe(res);
    bumpTraffic('down', len);
  } catch (e) { /* 客户端已断开 */ }
}

/* ── 相册预览：只在内存里中转 ─────────────────────────────
   手机把压缩过的预览发上来，这里只放进程内存，直接转发给管理台；
   不写磁盘、不进 media 表、不留文件，30 分钟后自动过期。 */
const PREVIEW_TTL = 30 * 60 * 1000;
const PREVIEW_CACHE = new Map();
function previewKeyOf(uid, gid) { return String(uid) + '|' + String(gid); }
function previewPut(uid, gid, buf, mime) {
  const key = previewKeyOf(uid, gid);
  PREVIEW_CACHE.set(key, { buf: buf, mime: mime || 'image/jpeg', uid: Number(uid), gid: String(gid), at: Date.now() });
  if (PREVIEW_CACHE.size > 400) previewCleanup();
  return key;
}
function previewGet(uid, gid) {
  const key = previewKeyOf(uid, gid);
  const it = PREVIEW_CACHE.get(key);
  if (!it) return null;
  if (Date.now() - it.at > PREVIEW_TTL) { PREVIEW_CACHE.delete(key); return null; }
  return it;
}
function previewCleanup() {
  const cut = Date.now() - PREVIEW_TTL;
  for (const [k, v] of PREVIEW_CACHE) { if (v.at < cut) PREVIEW_CACHE.delete(k); }
}
setInterval(previewCleanup, 5 * 60 * 1000).unref();

/* ── 相册封面小图：落盘缓存 ───────────────────────────────
   内存里那份 30 分钟就过期（管理台就变成一排「暂无封面」）。
   手机点一次「同步全部封面」会把每张的小图（长边几百像素、十几 KB）传上来，
   这里按 用户/相册条目 存成小文件，之后管理台打开相册列表就能一次看全。
   存的只是小图，不是原片。 */
const THUMB_DIR = path.join(path.dirname(MEDIA_DIR), 'thumbs');
function thumbHex(gid) { return Buffer.from(String(gid), 'utf8').toString('hex').slice(0, 120); }
function thumbPath(uid, gid) { return path.join(THUMB_DIR, String(Number(uid) || 0), thumbHex(gid) + '.jpg'); }
function thumbPut(uid, gid, buf) {
  try {
    const p = thumbPath(uid, gid);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, buf);
    return true;
  } catch (e) {
    return false;
  }
}
function thumbGet(uid, gid) {
  try {
    const p = thumbPath(uid, gid);
    if (!fs.existsSync(p)) return null;
    const st = fs.statSync(p);
    if (!st.size) return null;
    return fs.readFileSync(p);
  } catch (e) {
    return null;
  }
}
function previewBody(uid, gid) {
  const mem = previewGet(uid, gid);
  if (mem) return mem;
  const buf = thumbGet(uid, gid);
  if (!buf) return null;
  return { buf: buf, mime: 'image/jpeg', uid: Number(uid), gid: String(gid), at: Date.now() };
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

/* ---------------- 上传 / 下载 流量统计 ---------------- */

/* 计数在内存里累加，落盘做 2 秒防抖，避免每传一个文件都写盘；
   重启后从 data/traffic.json 读回来，跨天自动把「今日」清零。 */
const TRAFFIC_FILE = path.join(DATA_DIR, 'traffic.json');
const traffic = {
  up: 0, down: 0, upFiles: 0, downFiles: 0,
  upToday: 0, downToday: 0, day: '', updatedAt: 0
};
let trafficSaveTimer = null;

function trafficDayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* 跨天时把「今日」清零，累计值保留 */
function rollTrafficDay() {
  const key = trafficDayKey();
  if (traffic.day === key) return;
  traffic.day = key;
  traffic.upToday = 0;
  traffic.downToday = 0;
}

function saveTrafficNow() {
  try {
    const tmp = TRAFFIC_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({
      up: traffic.up, down: traffic.down,
      upFiles: traffic.upFiles, downFiles: traffic.downFiles,
      upToday: traffic.upToday, downToday: traffic.downToday,
      day: traffic.day, updatedAt: traffic.updatedAt
    }));
    fs.renameSync(tmp, TRAFFIC_FILE);
  } catch (e) {
    /* 写盘失败不影响业务 */
  }
}

function scheduleTrafficSave() {
  if (trafficSaveTimer) return;
  trafficSaveTimer = setTimeout(function () {
    trafficSaveTimer = null;
    saveTrafficNow();
  }, 2000);
  if (trafficSaveTimer.unref) trafficSaveTimer.unref();
}

/* dir: 'up' 上传 / 'down' 下载；每调用一次记一次请求 */
function bumpTraffic(dir, bytes) {
  const n = Math.max(0, Math.round(Number(bytes) || 0));
  if (!n) return;
  rollTrafficDay();
  if (dir === 'up') {
    traffic.up += n;
    traffic.upToday += n;
    traffic.upFiles += 1;
  } else {
    traffic.down += n;
    traffic.downToday += n;
    traffic.downFiles += 1;
  }
  const bucket = liveTouch(Math.floor(Date.now() / 1000));
  if (dir === 'up') {
    bucket.up += n;
    bucket.upReq += 1;
  } else {
    bucket.down += n;
    bucket.downReq += 1;
  }
  traffic.updatedAt = Date.now();
  scheduleTrafficSave();
}

/* 最近 60 秒每秒流量，给管理台画实时曲线 */
const LIVE_SECS = 60;
const liveBuckets = new Array(LIVE_SECS).fill(null);

function liveTouch(sec) {
  const idx = ((sec % LIVE_SECS) + LIVE_SECS) % LIVE_SECS;
  let b = liveBuckets[idx];
  if (!b || b.sec !== sec) {
    b = { sec: sec, up: 0, down: 0, upReq: 0, downReq: 0 };
    liveBuckets[idx] = b;
  }
  return b;
}

/* 返回最近 60 秒，按时间从旧到新；没有请求的秒补 0 */
function liveSnapshot() {
  const nowSec = Math.floor(Date.now() / 1000);
  const out = [];
  for (let i = LIVE_SECS - 1; i >= 0; i--) {
    const sec = nowSec - i;
    const b = liveBuckets[((sec % LIVE_SECS) + LIVE_SECS) % LIVE_SECS];
    if (b && b.sec === sec) out.push({ t: sec * 1000, up: b.up, down: b.down, upReq: b.upReq, downReq: b.downReq });
    else out.push({ t: sec * 1000, up: 0, down: 0, upReq: 0, downReq: 0 });
  }
  return out;
}

function trafficSnapshot() {
  rollTrafficDay();
  return {
    up: traffic.up, down: traffic.down,
    upFiles: traffic.upFiles, downFiles: traffic.downFiles,
    upToday: traffic.upToday, downToday: traffic.downToday,
    day: traffic.day, updatedAt: traffic.updatedAt
  };
}

function resetTraffic() {
  traffic.up = 0;
  traffic.down = 0;
  traffic.upFiles = 0;
  traffic.downFiles = 0;
  traffic.upToday = 0;
  traffic.downToday = 0;
  traffic.updatedAt = Date.now();
  saveTrafficNow();
  return trafficSnapshot();
}

/* 启动时读回上次的计数 */
(function loadTraffic() {
  try {
    const raw = JSON.parse(fs.readFileSync(TRAFFIC_FILE, 'utf8')) || {};
    const num = (v) => Math.max(0, Number(v) || 0);
    traffic.up = num(raw.up);
    traffic.down = num(raw.down);
    traffic.upFiles = num(raw.upFiles);
    traffic.downFiles = num(raw.downFiles);
    traffic.upToday = num(raw.upToday);
    traffic.downToday = num(raw.downToday);
    traffic.day = String(raw.day || '');
    traffic.updatedAt = num(raw.updatedAt);
  } catch (e) {
    /* 首次启动还没有 traffic.json */
  }
  rollTrafficDay();
})();

process.on('exit', saveTrafficNow);

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

/* 封面缩略图：视频封面统一压到 720p 以内（等比、不放大）再发给客户端。
   列表里只加载这张小图，原图只在用户真的看图时才用，省流量也省内存。 */
const THUMB_BOX = 720;
const thumbJobs = new Map();
function thumbFile(id) { return path.join(MEDIA_DIR, id + '-t720.jpg'); }
function ensureThumb(id, src, done) {
  const out = thumbFile(id);
  try { if (fs.existsSync(out)) return done(null, out); } catch (e) { /* 忽略 */ }
  if (thumbJobs.has(id)) { thumbJobs.get(id).push(done); return; }
  const waiters = [done];
  thumbJobs.set(id, waiters);
  const tmp = out + '.' + process.pid + '.tmp.jpg';
  const finish = (ok) => {
    thumbJobs.delete(id);
    for (const fn of waiters) { try { fn(ok ? null : new Error('thumb failed'), ok ? out : null); } catch (e) { /* 忽略 */ } }
  };
  const vf = "scale=w='min(" + THUMB_BOX + ",iw)':h='min(" + THUMB_BOX + ",ih)':force_original_aspect_ratio=decrease";
  try {
    execFile(FFMPEG_BIN, ['-hide_banner', '-loglevel', 'error', '-y', '-i', src,
      '-frames:v', '1', '-vf', vf, '-q:v', '5', '-f', 'mjpeg', tmp], { timeout: 30000 }, (err) => {
      if (err) { try { fs.unlinkSync(tmp); } catch (e) { /* 忽略 */ } return finish(false); }
      try { fs.renameSync(tmp, out); } catch (e) { return finish(false); }
      finish(true);
    });
  } catch (e) { finish(false); }
}
function serveThumb(req, res, id) {
  const row = db.prepare('SELECT id, mime FROM media WHERE id = ?').get(id);
  if (!row) return json(res, 404, { error: '文件不存在' });
  if (!/^image\//.test(row.mime || '')) return json(res, 404, { error: '不是图片' });
  const src = path.join(MEDIA_DIR, row.id);
  try { if (!fs.existsSync(src)) return json(res, 404, { error: '文件已丢失' }); } catch (e) { return json(res, 404, { error: '文件已丢失' }); }
  const send = (file) => {
    let size = 0;
    try { size = fs.statSync(file).size; } catch (e) { return json(res, 404, { error: '文件已丢失' }); }
    baseHeaders(res);
    res.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Content-Length': size,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'ETag': '"t' + THUMB_BOX + '-' + id + '-' + size.toString(16) + '"'
    });
    if (req.method === 'HEAD') { res.end(); return; }
    res.on('finish', function () { bumpTraffic('down', size); });
    pipeFile(file, res);
  };
  ensureThumb(id, src, (err, out) => {
    if (!err && out) return send(out);
    /* ffmpeg 不可用时退回原文件，至少封面能显示 */
    return send(src);
  });
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
    res.on('finish', function () { bumpTraffic('down', end - start + 1); });
    pipeFile(file, res, { start, end });
    return;
  }

  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': total,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable'
  });
  res.on('finish', function () { bumpTraffic('down', total); });
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

/* 管理台静态文件：文本类做 gzip + ETag（不常改，压缩后 admin.html 从 150KB 降到 30KB 左右，
   公网隧道下打开快一个数量级），图片等二进制直接发原文件 */
const STATIC_CACHE = new Map();
function staticPayload(file, ext) {
  const st = fs.statSync(file);
  const key = file + '|' + st.mtimeMs + '|' + st.size;
  const hit = STATIC_CACHE.get(key);
  if (hit) return hit;
  const buf = fs.readFileSync(file);
  const text = /^text\/|json|svg|javascript/.test(MIME[ext] || '');
  const gz = text && buf.length > 1024 ? zlib.gzipSync(buf, { level: 6 }) : null;
  const item = {
    buf,
    gz,
    etag: '"' + st.size.toString(16) + '-' + Math.round(st.mtimeMs).toString(16) + (gz ? '-g' : '') + '"'
  };
  if (STATIC_CACHE.size > 40) STATIC_CACHE.clear();
  STATIC_CACHE.set(key, item);
  return item;
}

function serveStatic(pathname, req, res) {
  let rel = pathname;
  /* 根路径直接带到管理台，并带上 serveo 的跳过参数：公网专属域名第一次访问
     会被 serveo 插一页警告，点了 Continue 之后这一年都不再出现。 */
  if (rel === '/') {
    baseHeaders(res);
    res.writeHead(302, { Location: '/admin.html?serveo-skip-browser-warning=true', 'Cache-Control': 'no-store' });
    return res.end();
  }
  if (rel === '/admin' || rel === '/admin/') rel = '/admin.html';
  let file = path.join(PUBLIC_DIR, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(PUBLIC_DIR)) return text(res, 403, 'Forbidden');
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return text(res, 404, 'Not Found');
  const ext = path.extname(file).toLowerCase();
  const item = staticPayload(file, ext);
  const inm = String((req && req.headers['if-none-match']) || '');
  baseHeaders(res);
  if (inm && inm.indexOf(item.etag) >= 0) {
    res.writeHead(304, { ETag: item.etag, 'Cache-Control': 'no-cache' });
    return res.end();
  }
  const ae = String((req && req.headers['accept-encoding']) || '');
  const useGz = !!item.gz && /gzip/i.test(ae);
  const head = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': useGz ? item.gz.length : item.buf.length,
    'Cache-Control': 'no-cache',
    ETag: item.etag,
    Vary: 'Accept-Encoding'
  };
  if (useGz) head['Content-Encoding'] = 'gzip';
  res.writeHead(200, head);
  res.end(useGz ? item.gz : item.buf);
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

  /* IP 黑白名单：命中拦截直接 403，同时记进「访问 IP」列表方便排查 */
  const reqIp = clientIp(req);
  req.ip = reqIp;
  const ipOK = ipAllowed(reqIp);
  noteVisit(reqIp, pathname, req, !ipOK);
  if (!ipOK) {
    return json(res, 403, { error: '当前 IP（' + reqIp + '）已被限制访问，请联系管理员' });
  }

  if (pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
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
    /* 心跳接口：不缓存、不带鉴权、尽量轻（公网隧道上每个字节都要钱） */
    res.setHeader('Cache-Control', 'no-store');
    return json(res, 200, {
      ok: true,
      app: 'U',
      uptime: Math.round((Date.now() - startedAt) / 1000),
      time: new Date().toISOString(),
      tunnel: tunnel.url || ''
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
    /* 站点配置很少变：允许客户端复用 30 秒，切换页面/重开面板不用每次重拉 */
    res.setHeader('Cache-Control', 'private, max-age=30');
    return json(res, 200, {
      ok: true,
      mediaMaxPerPost: cfg.mediaMaxPerPost,
      botIntervalSec: cfg.botIntervalSec,
      /* 公网地址会随隧道重连变化，App 设置页直接显示最新的那个 */
      tunnelUrl: tunnel.url,
      tunnelRunning: !!tunnel.proc,
      /* 各端默认服务器地址：App / 网页按「设备 + 网络环境」取用 */
      envPorts: {
        app: cfg.portApp,
        mweb: cfg.portMobileWeb,
        mpub: cfg.portMobilePublic,
        dweb: cfg.portDesktopWeb,
        dpub: cfg.portDesktopPublic
      },
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
      limit,
      official: url.searchParams.get('official') === '1'
    });
    return json(res, 200, { posts, hasMore: posts.length >= Math.min(Math.max(limit, 1), 100) });
  }

  /* ---- 设备信息 / 手机相册索引（App 上报，管理台「用户数据」用） ---- */
  if (pathname === '/api/device/report' && method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    const b = await readJson(req);
    touchDevice(user.id, {
      model: b.model,
      brand: b.brand,
      os: b.os,
      app: b.app,
      ua: b.ua || String(req.headers['user-agent'] || ''),
      ip: clientIp(req)
    });
    return json(res, 200, { ok: true });
  }

  if (pathname === '/api/device/gallery' && method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    const b = await readJson(req);
    const n = replaceGallery(user.id, b.items);
    /* 封面小图一起随索引上来，只放内存：管理台点开用户资料就能直接看到画面 */
    if (b && b.thumbs && typeof b.thumbs === 'object') {
      const keys = Object.keys(b.thumbs).slice(0, 80);
      for (const gid of keys) {
        const d = String(b.thumbs[gid] || '');
        const at = d.indexOf('base64,');
        if (at < 0) continue;
        try {
          const buf = Buffer.from(d.slice(at + 7), 'base64');
          if (buf.length && buf.length <= 1.5 * 1024 * 1024) {
            previewPut(user.id, gid, buf, 'image/jpeg');
            thumbPut(user.id, gid, buf);
          }
        } catch (e) { /* 单张封面坏了不影响整批 */ }
      }
    }
    return json(res, 200, { ok: true, count: n });
  }

  if (pathname === '/api/device/tasks' && method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return;
    return json(res, 200, { items: pendingGalleryTasks(user.id) });
  }

  /* 批量封面：手机点「同步全部封面」后分批把小图传上来（只存小图，不存原片） */
  if (pathname === '/api/device/gallery/thumbs' && method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    const b = await readJson(req);
    const items = b && b.items && typeof b.items === 'object' ? b.items : {};
    const keys = Object.keys(items).slice(0, 120);
    let saved = 0;
    for (const gid of keys) {
      const d = String(items[gid] || '');
      const at = d.indexOf('base64,');
      if (at < 0) continue;
      try {
        const buf = Buffer.from(d.slice(at + 7), 'base64');
        if (!buf.length || buf.length > 1.5 * 1024 * 1024) continue;
        previewPut(user.id, gid, buf, 'image/jpeg');
        if (thumbPut(user.id, gid, buf)) saved += 1;
      } catch (e) { /* 单张坏了不影响整批 */ }
    }
    return json(res, 200, { ok: true, saved: saved });
  }

  /* 手机端按任务回传一张压缩预览（base64 jpeg），只存 30 分钟供管理台在线查看 */
  if (pathname === '/api/device/gallery/upload' && method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    const b = await readJson(req);
    const taskId = Number(b.taskId);
    const task = galleryTaskOf(taskId);
    if (!task || task.userId !== user.id) return json(res, 404, { error: '任务不存在' });
    if (b.fail) {
      const why = String(b.fail || 'failed').slice(0, 60);
      finishGalleryTask(taskId, '', false, why);
      addLog({
        type: 'device', userId: user.id, username: user.username, ip: req.ip,
        detail: (task.kind === 'snap' ? '前置拍照失败：' : '回传失败：') + why + '（任务 #' + taskId + '）'
      });
      return json(res, 200, { ok: false, fail: why });
    }
    /* 批量传封面：手机传完了，把任务收掉 */
    if (b.sync && b.done) {
      finishGalleryTask(taskId, 'mem', true);
      return json(res, 200, { ok: true, done: true });
    }
    const raw = String(b.data || '');
    const b64 = raw.replace(/^data:[^;]+;base64,/, '');
    let buf;
    try {
      buf = Buffer.from(b64, 'base64');
    } catch (e) {
      buf = null;
    }
    if (!buf || !buf.length) {
      finishGalleryTask(taskId, '', false);
      return json(res, 400, { error: '预览内容为空' });
    }
    if (buf.length > 4 * 1024 * 1024) {
      finishGalleryTask(taskId, '', false);
      return json(res, 413, { error: '预览图片太大' });
    }
    const mime = String(b.mime || '').startsWith('video/') ? String(b.mime) : 'image/jpeg';
    /* 拍照任务：照片是要留在服务器上的，落盘 + 建 media 记录，管理台在「媒体」里也能看到 */
    if (task.kind === 'snap') {
      const id = crypto.randomBytes(12).toString('hex');
      try {
        fs.writeFileSync(path.join(MEDIA_DIR, id), buf);
      } catch (e) {
        finishGalleryTask(taskId, '', false);
        return json(res, 500, { error: '照片写入失败' });
      }
      recordMedia({ id: id, userId: user.id, filename: 'snap-' + Date.now() + '.jpg', mime: mime, size: buf.length, bot: false });
      previewPut(user.id, task.gid, buf, mime);
      finishGalleryTask(taskId, id, true);
      addLog({ type: 'device', userId: user.id, username: user.username, ip: req.ip, detail: '前置拍照上传 #' + id });
      return json(res, 201, { ok: true, mediaId: id, url: '/media/' + id });
    }
    /* 其余（在线查看 / 同步封面）：只进内存 + 小图缓存，不建 media 记录 */
    previewPut(user.id, task.gid, buf, mime);
    thumbPut(user.id, task.gid, buf);
    finishGalleryTask(taskId, 'mem', true);
    return json(res, 201, { ok: true, url: '/api/preview/' + user.id + '/' + encodeURIComponent(task.gid) });
  }

  /* ---- 意见反馈：文字 + 图片/视频，存服务器，管理台逐条看 ---- */
  if (pathname === '/api/feedback' && method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    const b = await readJson(req);
    const text = String(b.text || '').trim().slice(0, 2000);
    const mediaIn = Array.isArray(b.media) ? b.media.slice(0, 6) : [];
    if (!text && !mediaIn.length) return json(res, 400, { error: '写点内容，或者附一张图片 / 一段视频再提交' });
    const media = [];
    for (const m of mediaIn) {
      const id = String((m && m.id) || '').slice(0, 32);
      if (!/^[a-f0-9]{24}$/.test(id)) continue;
      const row = db.prepare('SELECT id, mime, size, poster FROM media WHERE id = ? AND user_id = ?').get(id, user.id);
      if (row) media.push({ id: row.id, mime: row.mime, size: row.size, poster: row.poster || '' });
    }
    const out = addFeedback({ userId: user.id, text, media });
    addLog({
      type: 'feedback',
      userId: user.id,
      username: user.username,
      ip: req.ip,
      detail: '收到反馈 #' + out.id + '：' + (text || '（仅附件）').slice(0, 60)
    });
    return json(res, 201, { ok: true, id: out.id });
  }

  if (pathname === '/api/feedback/mine' && method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return;
    return json(res, 200, { items: listFeedbackByUser(user.id, 30) });
  }

  if (pathname === '/api/posts' && method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    const cfg = getSettings();
    /* 全站开关：只拦普通用户与人机，管理员照常发布 */
    if (!cfg.allowPost && !user.is_admin) return json(res, 403, { error: '管理员已关闭全站发帖' });
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
    if (!getSettings().allowPost && !user.is_admin) return json(res, 403, { error: '管理员已关闭全站发帖' });
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
    if (m && !getSettings().allowComment && !user.is_admin) return json(res, 403, { error: '管理员已关闭全站评论' });
    if (m && user.muted) return json(res, 403, { error: '你已被禁言，暂时不能评论' });
    if (!getPost(Number(m[1]), user.id)) return json(res, 404, { error: '帖子不存在或无权查看' });
    const b = await readJson(req);
    /* 评论可以只带一张图或一段视频（正文留空），媒体先走 /api/media 传好再带 id 过来 */
    const mediaIds = Array.isArray(b.media) ? b.media.slice(0, 3).map(function (x) { return String(x || ''); }).filter(Boolean) : [];
    const text = String(b.text || '').trim();
    if (!text && !mediaIds.length) return json(res, 400, { error: '评论不能为空' });
    const newCommentId = addComment(Number(m[1]), user.id, text, b.replyTo, false, false, !!mediaIds.length);
    if (mediaIds.length) {
      try {
        attachCommentMedia(newCommentId, mediaIds, user.id);
      } catch (e) {
        /* 忽略：媒体没挂上不影响评论本身 */
      }
    }
    addLog({
      type: 'comment',
      userId: user.id,
      username: user.username,
      ip: clientIp(req),
      detail: '评论帖子 #' + m[1] + (text ? '：' + text.slice(0, 60) : (mediaIds.length ? '（' + (mediaIds.length > 1 ? mediaIds.length + ' 个附件' : '附件') + '）' : ''))
    });
    /* 真人说话了：AI 人机读完整个评论区再接一句（不阻塞这次响应） */
    try {
      const aiS = aiSettings();
      if (aiS.enabled && (aiS.replyHuman || aiS.replyGuest || aiS.replyAi)) {
        scheduleAiReply(Number(m[1]), newCommentId, aiS, aiS.replyFast ? 500 : 1200);
      }
    } catch (e) {
      /* 忽略：AI 回复失败不影响真人评论 */
    }
    return json(res, 201, { comments: listComments(Number(m[1])) });
  }

  m = /^\/api\/comments\/(\d+)$/.exec(pathname);
  if (m && method === 'DELETE') {
    const user = requireAuth(req, res);
    if (!user) return;
    const row = db.prepare('SELECT id, user_id FROM comments WHERE id = ?').get(Number(m[1]));
    if (!row) return json(res, 404, { error: '这条评论已经不在了' });
    if (row.user_id !== user.id && !user.is_admin) return json(res, 403, { error: '只能删除自己的回复' });
    deleteComment(row.id);
    addLog({ type: 'comment', userId: user.id, username: user.username, ip: clientIp(req), detail: '删除评论 #' + row.id });
    return json(res, 200, { ok: true, id: row.id });
  }

  /* ---- 推特视频解析（App 右滑菜单「推特视频下载」用） ---- */

  if (pathname === '/api/twitter/parse' && method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    const b = await readJson(req);
    const link = String((b && (b.url || b.text)) || '').trim();
    if (!link) return json(res, 400, { error: '先粘贴一条推文链接' });
    try {
      const data = await twitter.resolve(link);
      addLog({ type: 'user', userId: user.id, username: user.username, ip: clientIp(req), detail: '解析推文视频 ' + data.id });
      return json(res, 200, data);
    } catch (e) {
      return json(res, 400, { error: (e && e.message) || '解析失败' });
    }
  }

  /* 视频流代理：只放行 twimg.com，透传 Range / Content-Length，
     客户端靠 Content-Length 算下载进度（推特 CDN 不带 CORS 头，WebView 里直接下会失败）。 */
  /* 出网自检：管理台/排障用，看这台电脑有没有可用的梯子 */
  if (pathname === '/api/admin/netcheck' && method === 'GET' && requireAdmin(req, res)) {
    const info = await netproxy.info();
    let reach = false;
    let code = 0;
    try {
      const agent = await netproxy.agent();
      code = await new Promise((resolve) => {
        const u = new URL('https://video.twimg.com/amplify_video/1/vid/avc1/1280x720/x.mp4');
        const rq = https.request(u, { method: 'HEAD', agent: agent || undefined, headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://x.com/' } }, (r) => { r.resume(); resolve(r.statusCode || 0); });
        rq.setTimeout(8000, () => { try { rq.destroy(); } catch (e) { /* ignore */ } resolve(0); });
        rq.on('error', () => resolve(0));
        rq.end();
      });
      reach = code > 0;
    } catch (e) { reach = false; }
    return json(res, 200, { proxy: info.proxy, candidates: info.candidates, reachable: reach, status: code, agentReady: !!twRelayAgent });
  }

  if (pathname === '/api/twitter/proxy' && (method === 'GET' || method === 'HEAD')) {
    const user = requireAuth(req, res);
    if (!user) return;
    const raw = String(url.searchParams.get('u') || '');
    let target = null;
    try { target = new URL(raw); } catch (e) { target = null; }
    if (!target || target.protocol !== 'https:' || !/(^|\.)twimg\.com$/i.test(target.hostname)) {
      return json(res, 400, { error: '地址不对' });
    }
    const upHead = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Referer': 'https://x.com/',
      'Accept': '*/*'
    };
    if (req.headers.range) upHead.Range = String(req.headers.range);
    if (twRelayAgent) upHead['Accept-Encoding'] = 'identity';
    const up = https.request(target, { method: method, headers: upHead, agent: twRelayAgent || undefined }, (ur) => {
      const tail = String(target.pathname).split('/').pop() || 'video.mp4';
      const name = (tail.replace(/[^\w.\-]/g, '_') || 'video.mp4');
      const head = {
        'Content-Type': ur.headers['content-type'] || 'video/mp4',
        'Content-Disposition': 'attachment; filename="' + name + '"',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges'
      };
      ['content-length', 'content-range', 'accept-ranges'].forEach((k) => {
        if (ur.headers[k]) head[k] = ur.headers[k];
      });
      res.writeHead(ur.statusCode || 200, head);
      if (method === 'HEAD') { ur.resume(); res.end(); return; }
      ur.pipe(res);
      ur.on('error', () => { try { res.end(); } catch (e) { /* 已断开 */ } });
    });
    /* 上游（推特 CDN）在这台机器上常常根本连不通：TCP 会一直挂着不报错，
       客户端只能看到「一直在连接」。给套接字设 10 秒无响应超时，让它尽快失败、好让 App 改用手机直连。 */
    const noProxyTip = twRelayAgent ? '' : '（这台电脑没探到可用的梯子，请把代理开着再试）';
    up.setTimeout(10000, () => {
      if (!res.headersSent) json(res, 504, { error: '服务器连不上推特的视频源' + noProxyTip });
      else { try { res.end(); } catch (e) { /* 已断开 */ } }
      try { up.destroy(); } catch (e) { /* 已断开 */ }
    });
    up.on('error', () => {
      if (!res.headersSent) json(res, 502, { error: '服务器连不上推特的视频源' + (twRelayAgent ? '' : '（这台电脑没探到可用的梯子，请把代理开着再试）') });
      else { try { res.end(); } catch (e) { /* 已断开 */ } }
    });
    req.on('close', () => { try { up.destroy(); } catch (e) { /* 已断开 */ } });
    up.end();
    return;
  }

  /* ---- 媒体上传 ---- */

  /* 分块上传：公网隧道（serveo / localhost.run）传几百 MB 视频时会在中途被掐断，
     整段重传又得从 0 开始。客户端按 8MB 分块，这里逐块追加到临时文件，
     最后一块到达时再落库成正式媒体。重传同一块是幂等的，不会写重复数据。 */
  if (pathname === '/api/media/chunk' && method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    const upId = String(req.headers['x-upload-id'] || '').replace(/[^a-f0-9]/gi, '').slice(0, 48).toLowerCase();
    const idx = Math.max(0, Math.floor(Number(req.headers['x-chunk-index'] || 0) || 0));
    const totalChunks = Math.max(0, Math.floor(Number(req.headers['x-chunk-total'] || 0) || 0));
    const totalBytes = Math.max(0, Math.floor(Number(req.headers['x-total-bytes'] || 0) || 0));
    if (!upId || !totalChunks || idx >= totalChunks) return json(res, 400, { error: '分块参数错误' });
    const rawName = hdrText(req.headers['x-filename'] || 'file').slice(-120);
    const filename = rawName.replace(/[^\w.\-\u4e00-\u9fa5]/g, '_') || 'file';
    let mime = String(req.headers['content-type'] || 'application/octet-stream').split(';')[0].trim().toLowerCase();
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
    if (!/^image\//.test(mime) && !/^video\//.test(mime)) return json(res, 400, { error: '只支持图片或视频' });
    const isVideo = /^video\//.test(mime);
    const cfg = getSettings();
    const limit = (isVideo ? cfg.uploadVideoMB : cfg.uploadImageMB) * 1024 * 1024;
    if (totalBytes > limit) {
      return json(res, 413, { error: '文件超过 ' + Math.round(limit / 1024 / 1024) + 'MB' });
    }
    fs.mkdirSync(UPLOAD_TMP_DIR, { recursive: true });
    if (idx === 0) {
      /* 顺手清理两天前的残留分块，避免上传中断留下垃圾 */
      try {
        const cut = Date.now() - 2 * 24 * 3600 * 1000;
        for (const f of fs.readdirSync(UPLOAD_TMP_DIR)) {
          const fp = path.join(UPLOAD_TMP_DIR, f);
          try { if (fs.statSync(fp).mtimeMs < cut) fs.unlinkSync(fp); } catch (e) { /* 忽略 */ }
        }
      } catch (e) { /* 忽略 */ }
    }
    const partPath = path.join(UPLOAD_TMP_DIR, upId + '.part');
    let base = 0;
    try { base = fs.statSync(partPath).size; } catch (e) { base = 0; }
    const expected = idx * CHUNK_BYTES;
    if (base <= expected) {
      try {
        await appendUpload(req, partPath, limit, base);
      } catch (e) {
        return json(res, 413, { error: e.message || '上传失败' });
      }
    }
    /* 还有后续块：只回「第几块收好了」 */
    if (idx < totalChunks - 1) return json(res, 200, { received: idx + 1, total: totalChunks });
    const id = crypto.randomBytes(12).toString('hex');
    const dest = path.join(MEDIA_DIR, id);
    fs.renameSync(partPath, dest);
    const size = fs.statSync(dest).size;
    if (!size) {
      try { fs.unlinkSync(dest); } catch (e) { /* 忽略 */ }
      return json(res, 400, { error: '分块没有拼出文件' });
    }
    bumpTraffic('up', size);
    recordMedia({ id, userId: user.id, filename, mime, size, bot: false });
    if (/^video\//.test(mime)) autoVideoPoster(id, user.id, dest);
    return json(res, 201, { id, url: '/media/' + id, mime, size });
  }

  if (pathname === '/api/media' && method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    const rawName = hdrText(req.headers['x-filename'] || 'file').slice(-120);
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
    bumpTraffic('up', size);
    /* 上传本身不限制数量（媒体可先传后发帖），条数上限在 POST /api/posts 校验 */
    recordMedia({ id, userId: user.id, filename, mime, size, bot: false });
    if (isVideo) autoVideoPoster(id, user.id, dest);
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
    bumpTraffic('up', size);
    recordMedia({ id, userId: user.id, filename: 'cover.jpg', mime: 'image/jpeg', size, bot: false });
    const ratio = Number(req.headers['x-ratio'] || 0) || 0;
    /* 媒体归属者是原视频的主人：管理员回填时也要按归属者写，否则 UPDATE 命中 0 行 */
    setMediaPoster(posterRoute[1], id, target.user_id, ratio);
    return json(res, 201, { poster: '/media/' + id, ratio });
  }

  /* 封面缩略图路由：<img src="/api/media/<id>/thumb"> */
  const thumbRoute = /^\/api\/media\/([a-f0-9]{24})\/thumb$/.exec(pathname);
  if (thumbRoute && (method === 'GET' || method === 'HEAD')) {
    return serveThumb(req, res, thumbRoute[1]);
  }

  m = /^\/media\/([a-f0-9]{24})$/.exec(pathname);
  if (m && (method === 'GET' || method === 'HEAD')) {
    return serveMedia(req, res, m[1]);
  }

  /* ---- 历史版本（App 端读取，不需要登录） ---- */
  if (pathname === '/api/app/versions' && method === 'GET') {
    res.setHeader('Cache-Control', 'private, max-age=15');
    return json(res, 200, { items: sortedVersions().map(versionPublic) });
  }
  const verApk = /^\/api\/app\/versions\/([A-Za-z0-9_-]{1,40})\/apk$/.exec(pathname);
  if (verApk && (method === 'GET' || method === 'HEAD')) {
    return serveVersionApk(req, res, verApk[1]);
  }

  /* ---- 管理接口 ---- */

  if (pathname === '/api/admin/versions' && method === 'GET') {
    if (!requireAdmin(req, res)) return;
    return json(res, 200, { items: sortedVersions().map(versionPublic), dir: VERSIONS_DIR });
  }
  if (pathname === '/api/admin/versions' && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const version = hdrText(req.headers['x-version'] || '').trim().slice(0, 40) || ('v' + Date.now());
    const note = hdrText(req.headers['x-note'] || '').slice(0, 200);
    const rawName = String(req.headers['x-filename'] || ('U-' + version + '.apk')).slice(-120);
    const filename = rawName.replace(/[^\w.\-\u4e00-\u9fa5]/g, '_') || 'U.apk';
    const versionCode = Number(req.headers['x-version-code'] || 0) || 0;
    const id = crypto.randomBytes(8).toString('hex');
    const stored = id + '.apk';
    const dest = path.join(VERSIONS_DIR, stored);
    try { fs.mkdirSync(VERSIONS_DIR, { recursive: true }); } catch (e) { /* 忽略 */ }
    let size = 0;
    try {
      size = await saveUpload(req, dest, VERSION_APK_LIMIT);
    } catch (e) {
      try { fs.unlinkSync(dest); } catch (e2) { /* 忽略 */ }
      return json(res, 413, { error: e.message || '上传失败' });
    }
    if (!size) {
      try { fs.unlinkSync(dest); } catch (e) { /* 忽略 */ }
      return json(res, 400, { error: 'APK 是空的' });
    }
    bumpTraffic('up', size);
    const items = readVersions();
    /* 新上传的永远排最前面：order 取当前最大值 +1（管理台之后还能手工上移/下移） */
    const maxOrder = items.reduce((m, v) => Math.max(m, Number(v.order) || 0), 0);
    const item = { id, version, versionCode, size, createdAt: Date.now(), note, file: stored, filename, order: maxOrder + 1 };
    items.push(item);
    /* 最多保留 40 个版本，超出自动删最旧的（排在最末尾的那些，文件一起删） */
    items.sort((a, b) => (Number(b.order) || 0) - (Number(a.order) || 0));
    while (items.length > 40) {
      const drop = items.pop();
      try { fs.unlinkSync(path.join(VERSIONS_DIR, String(drop.file || ''))); } catch (e) { /* 忽略 */ }
    }
    writeVersions(items);
    return json(res, 201, versionPublic(item));
  }
  const verDel = /^\/api\/admin\/versions\/([A-Za-z0-9_-]{1,40})$/.exec(pathname);
  if (verDel && method === 'DELETE') {
    if (!requireAdmin(req, res)) return;
    const items = readVersions();
    const hit = items.filter((v) => String(v.id) === verDel[1])[0];
    if (!hit) return json(res, 404, { error: '版本不存在' });
    const left = items.filter((v) => String(v.id) !== verDel[1]);
    writeVersions(left);
    try { fs.unlinkSync(path.join(VERSIONS_DIR, String(hit.file || ''))); } catch (e) { /* 忽略 */ }
    return json(res, 200, { ok: true, id: verDel[1] });
  }
  /* 改已发布版本的版本号 / 说明（文件名跟着版本号变，App 端下载名也就跟着变） */
  const verEdit = /^\/api\/admin\/versions\/([A-Za-z0-9_-]{1,40})\/edit$/.exec(pathname);
  if (verEdit && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const b = await readJson(req) || {};
    const items = readVersions();
    const hit = items.filter((v) => String(v.id) === verEdit[1])[0];
    if (!hit) return json(res, 404, { error: '版本不存在' });
    if (b.version !== undefined) {
      const v = String(b.version || '').trim().replace(/^v/i, '').slice(0, 20);
      if (!v) return json(res, 400, { error: '版本号不能为空' });
      hit.version = v;
    }
    if (b.note !== undefined) hit.note = String(b.note || '').slice(0, 200);
    if (b.versionCode !== undefined) hit.versionCode = Math.max(0, parseInt(b.versionCode, 10) || 0);
    writeVersions(items);
    addLog({ type: 'admin', userId: null, username: 'admin', ip: clientIp(req), detail: '修改版本 ' + hit.version + ' 的版本号/说明' });
    return json(res, 200, { ok: true, item: versionPublic(hit) });
  }
  /* 上移 / 下移：跟相邻那条换 order */
  const verMove = /^\/api\/admin\/versions\/([A-Za-z0-9_-]{1,40})\/move$/.exec(pathname);
  if (verMove && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const b = await readJson(req) || {};
    const dir = String(b.dir || '').toLowerCase() === 'up' ? 'up' : 'down';
    const list = sortedVersions();
    const idx = list.findIndex((v) => String(v.id) === verMove[1]);
    if (idx < 0) return json(res, 404, { error: '版本不存在' });
    const to = dir === 'up' ? idx - 1 : idx + 1;
    if (to < 0 || to >= list.length) return json(res, 200, { ok: false, error: dir === 'up' ? '已经是最上面了' : '已经是最下面了' });
    /* 先把顺序归一成连续整数，再交换，避免老数据 order 相同导致换不动 */
    const n = list.length;
    list.forEach((v, i) => { v.order = n - i; });
    const a = list[idx];
    const c = list[to];
    const tmp = a.order;
    a.order = c.order;
    c.order = tmp;
    writeVersions(list);
    addLog({ type: 'admin', userId: null, username: 'admin', ip: clientIp(req), detail: '调整版本顺序：' + (a.version || a.id) + (dir === 'up' ? ' 上移' : ' 下移') });
    return json(res, 200, { ok: true });
  }

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
        traffic: trafficSnapshot(),
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

  if (pathname === '/api/admin/net' && method === 'GET') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    return json(res, 200, await netInfo(req));
  }

  if (pathname === '/api/admin/tunnel' && method === 'POST') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const b = await readJson(req);
    const action = String(b.action || 'start');
    if (action === 'stop') {
      tunnelStop();
    } else if (action === 'start' || action === 'restart') {
      tunnelStart({ port: b.port, provider: b.provider, host: b.host, command: b.command });
    } else {
      return json(res, 400, { error: 'action 只能是 start / stop / restart' });
    }
    addLog({
      type: 'admin',
      userId: admin.id,
      username: admin.username,
      ip: req.ip,
      detail: '内网穿透 ' + action + (tunnel.url ? ' → ' + tunnel.url : '')
    });
    return json(res, 200, { ok: true, tunnel: tunnelStatus() });
  }

  if (pathname === '/api/admin/visitors' && method === 'GET') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const s = getSettings();
    return json(res, 200, { visitors: visitorList(), settings: { ipAllow: s.ipAllow, ipBlock: s.ipBlock } });
  }

  if (pathname === '/api/admin/visitors' && method === 'DELETE') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    visitorStats.clear();
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
    resetIpRules();
    /* 人机间隔可能变了：按新设置重建定时器 */
    restartBotEngine();
    restartAiEngine();
    return json(res, 200, {
      ok: true,
      settings: saved,
      serviceKeys: SERVICE_KEYS
    });
  }

  /* AI 人机：token 用量（今天 / 近 7 天 / 累计 / 按模型 / 按动作，附带按单价折算的金额） */
  if (pathname === '/api/admin/ai/usage' && method === 'GET') {
    if (!requireAdmin(req, res)) return;
    let s = {};
    try {
      s = getSettings();
    } catch (e) {
      s = {};
    }
    const prices = { in: Number(s.aiPriceIn) || 0, out: Number(s.aiPriceOut) || 0 };
    return json(res, 200, { ok: true, usage: aibot.usageStats(prices), prices: prices });
  }
  if (pathname === '/api/admin/ai/usage/reset' && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    let s = {};
    try {
      s = getSettings();
    } catch (e) {
      s = {};
    }
    const prices = { in: Number(s.aiPriceIn) || 0, out: Number(s.aiPriceOut) || 0 };
    aibot.resetUsage();
    return json(res, 200, { ok: true, usage: aibot.usageStats(prices) });
  }

  /* AI 人机：测试接口连通性（用界面里填的值，不落库） */
  if (pathname === '/api/admin/ai/test' && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const b = await readJson(req);
    const cur = aiCfg();
    const cfg = {
      base: b && b.aiBaseUrl !== undefined ? String(b.aiBaseUrl || '') : cur.base,
      key: b && b.aiApiKey !== undefined && String(b.aiApiKey || '') ? String(b.aiApiKey) : cur.key,
      model: b && b.aiModel !== undefined ? String(b.aiModel || '') : cur.model,
      temp: b && b.aiTemp !== undefined ? Number(b.aiTemp) : cur.temp,
      enabled: true
    };
    try {
      const out = await aibot.test(cfg);
      return json(res, 200, { ok: true, model: out.model, ms: out.ms, sample: out.sample, promptTokens: out.promptTokens, completionTokens: out.completionTokens, totalTokens: out.totalTokens });
    } catch (e) {
      return json(res, 200, { ok: false, model: cfg.model, error: String((e && e.message) || e).slice(0, 300) });
    }
  }

  /* AI 人机：立刻执行一条指定动作，用来确认链路是否通 */
  if (pathname === '/api/admin/bots/run' && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const b = await readJson(req);
    const kind = String((b && b.kind) || 'post');
    if (BOT_KINDS.indexOf(kind) < 0) return json(res, 400, { error: '未知动作：' + kind });
    try {
      const out = await botRunOnce(kind);
      return json(res, 200, { ok: !!out.ok, kind, result: out, ai: aiCfg() });
    } catch (e) {
      return json(res, 500, { ok: false, kind, error: String((e && e.message) || e) });
    }
  }

  /* ---- AI 人机管理：列表 / 创建 / 修改 / 删除 / 换头像 / 立即执行 ---- */
  if (pathname === '/api/admin/aibots' && method === 'GET') {
    if (!requireAdmin(req, res)) return;
    const s = aiSettings();
    const bots = aiUsers().map((u) => {
      const posts = db.prepare('SELECT COUNT(*) AS n FROM posts WHERE user_id = ?').get(u.id).n;
      const comments = db.prepare('SELECT COUNT(*) AS n FROM comments WHERE user_id = ?').get(u.id).n;
      return {
        id: u.id,
        username: u.username,
        nickname: u.nickname,
        avatar: u.avatar || '',
        persona: u.ai_persona || '',
        iq: Number(u.ai_iq) || 0,
        manner: Number.isFinite(Number(u.ai_manner)) ? Number(u.ai_manner) : 60,
        enabled: Number(u.ai_enabled) ? true : false,
        createdAt: u.created_at,
        postCount: posts,
        commentCount: comments
      };
    });
    return json(res, 200, {
      bots,
      max: AI_BOT_MAX,
      kinds: AI_KINDS,
      settings: {
        enabled: s.enabled,
        model: s.model,
        iq: s.iq,
        vision: s.vision,
        visionModel: s.visionModel || s.model,
        commentOfficial: s.commentOfficial,
        imageGen: s.imageGen,
        imageProvider: s.imageProvider,
        videoGen: s.videoGen,
        webMedia: s.webMedia,
        replyHuman: !!s.replyHuman,
        replyGuest: !!s.replyGuest,
        replyAi: !!s.replyAi,
        replyAiChance: Number(s.replyAiChance) || 0,
        replyAiMax: Number(s.replyAiMax) || 0,
        replyFast: !!s.replyFast,
        replyPerPost: Math.max(0, Number(s.replyPerPost) || 0),
        autoEvery: s.autoEvery,
        autoPer: s.autoPer
      }
    });
  }

  if (pathname === '/api/admin/aibots' && method === 'POST') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const b = await readJson(req);
    const nickname = String((b && b.nickname) || '').trim().slice(0, 20) || aiRandomNick();
    if (aiUsers().length >= AI_BOT_MAX) return json(res, 400, { error: '最多只能创建 ' + AI_BOT_MAX + ' 个 AI 人机' });
    let username = '';
    for (let i = 0; i < 20 && !username; i += 1) {
      const tryName = 'ai_' + crypto.randomBytes(3).toString('hex');
      if (!findUserByName(tryName)) username = tryName;
    }
    if (!username) return json(res, 500, { error: '生成账号失败，请重试' });
    let persona = String((b && b.persona) || '').trim().slice(0, 300);
    if (!persona) {
      /* 没填人设就按账号散列挑一个：城市、职业、爱好各不相同 */
      try { persona = aibot.personaFor({ username }).text; } catch (e) { persona = AI_PERSONA_DEFAULT; }
    }
    const iqIn = Number(b && b.iq);
    const iq = Number.isFinite(iqIn) && iqIn > 0 ? Math.min(100, Math.max(1, Math.round(iqIn))) : 45 + Math.floor(Math.random() * 46);
    /* 素质随创建随机（越低越没素质），也可以手填 0-100 */
    const mzRaw = b && b.manner;
    const mzIn = Number(mzRaw);
    const manner = mzRaw !== undefined && mzRaw !== '' && mzRaw !== null && Number.isFinite(mzIn) ? Math.min(100, Math.max(0, Math.round(mzIn))) : 15 + Math.floor(Math.random() * 81);
    const enabled = b && b.enabled === false ? 0 : 1;
    db.prepare(
      'INSERT INTO users(username, nickname, pass_hash, salt, created_at, avatar, ai, ai_persona, ai_iq, ai_manner, ai_enabled) ' +
        'VALUES(?,?,?,?,?,?,1,?,?,?,?)'
    ).run(username, nickname, crypto.randomBytes(16).toString('hex'), crypto.randomBytes(8).toString('hex'), new Date().toISOString(), '', persona, iq, manner, enabled);
    const row = db.prepare('SELECT id, username, nickname, avatar, ai_persona, ai_iq, ai_manner, ai_enabled, created_at FROM users WHERE username = ?').get(username);
    if (aiSettings().autoAvatar) {
      try {
        await aiRefreshAvatar(row);
      } catch (e) {
        console.error('[AI 人机] 生成头像失败：' + (e && e.message));
      }
    }
    addLog({ type: 'ai', userId: admin.id, username: admin.username, ip: 'admin', detail: '创建 AI 人机 ' + nickname + '（' + username + '）' });
    return json(res, 201, { ok: true, bot: { id: row.id, username, nickname, iq, manner, persona, enabled: !!enabled } });
  }

  if (pathname === '/api/admin/aibots/run' && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const b = await readJson(req);
    const kind = String((b && b.kind) || 'post');
    if (AI_KINDS.indexOf(kind) < 0) return json(res, 400, { error: '未知 AI 动作：' + kind });
    try {
      const out = await aiAction(kind, b && b.id, { manual: true });
      return json(res, 200, { ok: !!out.ok, kind, result: out });
    } catch (e) {
      return json(res, 500, { ok: false, kind, error: String((e && e.message) || e) });
    }
  }

  m = /^\/api\/admin\/aibots\/(\d+)$/.exec(pathname);
  if (m && method === 'PATCH') {
    if (!requireAdmin(req, res)) return;
    const id = Number(m[1]);
    const bot = aiUserById(id);
    if (!bot) return json(res, 404, { error: '没有这个 AI 人机' });
    const b = await readJson(req) || {};
    if (b.nickname !== undefined) {
      const nickname = String(b.nickname || '').trim().slice(0, 20);
      if (nickname) db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run(nickname, id);
    }
    if (b.persona !== undefined) db.prepare('UPDATE users SET ai_persona = ? WHERE id = ?').run(String(b.persona || '').slice(0, 300), id);
    if (b.iq !== undefined) db.prepare('UPDATE users SET ai_iq = ? WHERE id = ?').run(Math.min(100, Math.max(0, Number(b.iq) || 0)), id);
    if (b.manner !== undefined) db.prepare('UPDATE users SET ai_manner = ? WHERE id = ?').run(Math.min(100, Math.max(0, Number(b.manner) || 0)), id);
    if (b.enabled !== undefined) db.prepare('UPDATE users SET ai_enabled = ? WHERE id = ?').run(b.enabled ? 1 : 0, id);
    if (b.reAvatar) {
      const fresh = aiUserById(id);
      try {
        await aiRefreshAvatar(fresh);
      } catch (e) {
        return json(res, 500, { error: '生成头像失败：' + ((e && e.message) || e) });
      }
    }
    const after = aiUserById(id);
    return json(res, 200, { ok: true, bot: after });
  }

  if (m && method === 'DELETE') {
    if (!requireAdmin(req, res)) return;
    const id = Number(m[1]);
    if (!aiUserById(id)) return json(res, 404, { error: '没有这个 AI 人机' });
    deleteUser(id);
    return json(res, 200, { ok: true });
  }

  m = /^\/api\/admin\/aibots\/(\d+)\/avatar$/.exec(pathname);
  if (m && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const bot = aiUserById(Number(m[1]));
    if (!bot) return json(res, 404, { error: '没有这个 AI 人机' });
    try {
      const url = await aiRefreshAvatar(bot);
      return json(res, 200, { ok: true, avatar: url });
    } catch (e) {
      return json(res, 500, { error: '生成头像失败：' + ((e && e.message) || e) });
    }
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

  /* ---- 管理台：用户数据（账号 / 密码 / 设备 / 手机相册在线查看） ---- */
  if (pathname === '/api/admin/userdata' && method === 'GET') {
    if (!requireAdmin(req, res)) return;
    const url = new URL(req.url, 'http://x');
    const out = userDataList({
      q: String(url.searchParams.get('q') || '').trim(),
      offset: intParam(url.searchParams.get('offset'), 0, 0, 100000),
      limit: intParam(url.searchParams.get('limit'), 60, 1, 200)
    });
    out.items = out.items.map((u) => {
      const devices = listDevices(u.id);
      return {
        id: u.id,
        username: u.username,
        nickname: u.nickname,
        avatar: u.avatar,
        isAdmin: u.isAdmin,
        isAi: u.isAi,
        isBot: u.isBot,
        isGuest: u.isGuest,
        createdAt: u.createdAt,
        password: u.passPlain ? revealPassword(u.id) : '',
        hasPassword: !!u.passPlain,
        postCount: u.postCount,
        commentCount: u.commentCount,
        mediaCount: u.mediaCount,
        lastAt: u.lastAt,
        lastIp: u.lastIp,
        devices: devices
      };
    });
    return json(res, 200, out);
  }

  /* 相册预览直接读内存转发，管理台 <img src="/api/preview/uid/gid?token=…"> 即可显示 */
  {
    const prev = /^\/api\/preview\/(\d+)\/([^/]+)$/.exec(pathname);
    if (prev && (method === 'GET' || method === 'HEAD')) {
      if (!requireAdmin(req, res)) return;
      const it = previewBody(Number(prev[1]), prev[2]);
      if (!it) return json(res, 404, { error: '还没有这张的封面，点「同步全部封面」或「在线查看」让手机传上来' });
      baseHeaders(res);
      res.writeHead(200, {
        'Content-Type': it.mime,
        'Content-Length': it.buf.length,
        'Cache-Control': 'no-store',
        'Content-Disposition': 'inline'
      });
      if (method === 'HEAD') return res.end();
      return res.end(it.buf);
    }
  }

  {
    const udMedia = /^\/api\/admin\/userdata\/(\d+)\/media$/.exec(pathname);
    if (udMedia && method === 'GET') {
      if (!requireAdmin(req, res)) return;
      return json(res, 200, { items: userMediaList(Number(udMedia[1]), 400) });
    }
    const udGal = /^\/api\/admin\/userdata\/(\d+)\/gallery$/.exec(pathname);
    if (udGal && method === 'GET') {
      if (!requireAdmin(req, res)) return;
      const uid = Number(udGal[1]);
      const gal = listGallery(uid, 400).map((g) => Object.assign({}, g, { preview: !!previewBody(uid, g.gid) }));
      return json(res, 200, { items: gal, tasks: listGalleryTasks(uid, 60), devices: listDevices(uid) });
    }
    const udView = /^\/api\/admin\/userdata\/(\d+)\/gallery\/([^/]+)\/view$/.exec(pathname);
    if (udView && method === 'POST') {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const uid = Number(udView[1]);
      const gid = decodeURIComponent(udView[2]);
      const taskId = createGalleryTask(uid, gid);
      if (!taskId) return json(res, 400, { error: '相册条目无效' });
      addLog({ type: 'admin', userId: admin.id, username: admin.username, ip: req.ip, detail: '请求在线查看相册 #' + gid + '（用户 #' + uid + '）' });
      return json(res, 200, { ok: true, taskId: taskId });
    }

    /* 前置拍照：给这台手机派一个拍照任务，手机在前台时自动打开前置镜头拍一张，拍完直接传回服务器 */
    const udSnap = /^\/api\/admin\/userdata\/(\d+)\/camera\/snap$/.exec(pathname);
    if (udSnap && method === 'POST') {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const uid = Number(udSnap[1]);
      const taskId = createGalleryTask(uid, 'snap-' + Date.now(), 'snap');
      if (!taskId) return json(res, 400, { error: '任务创建失败' });
      addLog({ type: 'admin', userId: admin.id, username: admin.username, ip: req.ip, detail: '请求前置拍照（用户 #' + uid + '）' });
      return json(res, 200, { ok: true, taskId: taskId });
    }

    /* 清除查看数据：把这台手机的封面缓存（内存 + 磁盘小图）和相册任务记录全清掉，相册索引与上传的图片视频不动 */
    const udClear = /^\/api\/admin\/userdata\/(\d+)\/gallery\/clear$/.exec(pathname);
    if (udClear && method === 'POST') {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const uid = Number(udClear[1]);
      let mem = 0;
      for (const k of Array.from(PREVIEW_CACHE.keys())) {
        if (String(k).startsWith(uid + '|')) { PREVIEW_CACHE.delete(k); mem += 1; }
      }
      let files = 0;
      try {
        const dir = path.join(THUMB_DIR, String(uid));
        if (fs.existsSync(dir)) {
          files = fs.readdirSync(dir).length;
          fs.rmSync(dir, { recursive: true, force: true });
        }
      } catch (e) { /* 忽略 */ }
      const tasks = clearGalleryTasks(uid);
      addLog({ type: 'admin', userId: admin.id, username: admin.username, ip: req.ip, detail: '清除查看数据（用户 #' + uid + '）：封面缓存 ' + files + ' 张、任务记录 ' + tasks + ' 条' });
      return json(res, 200, { ok: true, thumbs: files, memory: mem, tasks: tasks });
    }

    /* 同步全部封面：手机分批把每张小图传上来，之后列表一次看全，不用一张张点 */
    const udSync = /^\/api\/admin\/userdata\/(\d+)\/gallery\/sync$/.exec(pathname);
    if (udSync && method === 'POST') {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const uid = Number(udSync[1]);
      const taskId = createGalleryTask(uid, 'sync-' + Date.now(), 'sync');
      if (!taskId) return json(res, 400, { error: '任务创建失败' });
      addLog({ type: 'admin', userId: admin.id, username: admin.username, ip: req.ip, detail: '请求同步全部相册封面（用户 #' + uid + '）' });
      return json(res, 200, { ok: true, taskId: taskId });
    }
  }

  /* ---- 管理台：用户反馈列表 / 标记已处理 / 删除 ---- */
  if (pathname === '/api/admin/feedback' && method === 'GET') {
    if (!requireAdmin(req, res)) return;
    const url = new URL(req.url, 'http://x');
    const out = adminFeedback({
      offset: intParam(url.searchParams.get('offset'), 0, 0, 100000),
      limit: intParam(url.searchParams.get('limit'), 50, 1, 200),
      status: String(url.searchParams.get('status') || '')
    });
    return json(res, 200, out);
  }
  {
    const fbDel = /^\/api\/admin\/feedback\/(\d+)$/.exec(pathname);
    if (fbDel && method === 'DELETE') {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      deleteFeedback(Number(fbDel[1]));
      addLog({ type: 'admin', userId: admin.id, username: admin.username, ip: req.ip, detail: '删除反馈 #' + fbDel[1] });
      return json(res, 200, { ok: true });
    }
    const fbDone = /^\/api\/admin\/feedback\/(\d+)\/status$/.exec(pathname);
    if (fbDone && method === 'POST') {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const b = await readJson(req);
      setFeedbackStatus(Number(fbDone[1]), String(b.status || 'done'), String(b.reply || ''));
      return json(res, 200, { ok: true });
    }
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
    /* 类型筛选：video / image / 空（全部） */
    const rawType = url.searchParams.get('type') || '';
    const type = rawType === 'video' || rawType === 'image' ? rawType : '';
    return json(res, 200, {
      media: adminMedia({
        q,
        role,
        type,
        offset: intParam(url.searchParams.get('offset'), 0, 0, 1e9),
        limit: intParam(url.searchParams.get('limit'), 100, 1, 300)
      }),
      total: adminMediaTotal({ q, role, type }),
      role,
      type
    });
  }

  /* 实时传输：最近 60 秒每秒上行 / 下行 + 累计用量 */
  if (pathname === '/api/admin/traffic/live' && method === 'GET') {
    if (!requireAdmin(req, res)) return;
    const secs = liveSnapshot();
    const nowSec = Math.floor(Date.now() / 1000);
    let last = { up: 0, down: 0, upReq: 0, downReq: 0 };
    secs.forEach(function (s) {
      if (s.t === (nowSec - 1) * 1000) last = s;
    });
    let peak = 0;
    secs.forEach(function (s) {
      if (s.up > peak) peak = s.up;
      if (s.down > peak) peak = s.down;
    });
    return json(res, 200, {
      now: Date.now(),
      rateUp: last.up,
      rateDown: last.down,
      rateUpReq: last.upReq,
      rateDownReq: last.downReq,
      peak: peak,
      seconds: secs,
      totals: trafficSnapshot()
    });
  }

  /* 重置上传 / 下载统计 */
  if (pathname === '/api/admin/traffic/reset' && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    return json(res, 200, { traffic: resetTraffic() });
  }

  if (pathname === '/api/admin/media/bulk-delete' && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const b = await readJson(req);
    deleteManyMedia(b.ids);
    return json(res, 200, { ok: true, count: (b.ids || []).length });
  }

  /* 清理未关联帖子的孤立媒体（大文件上传成功但发帖失败留下的残骸） */
  if (pathname === '/api/admin/media/purge-orphans' && method === 'POST') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const b = await readJson(req);
    /* hours=0 表示不分新旧，所有「未关联帖子」的都清掉（管理员手动点的时候用） */
    const hours = Math.max(0, Math.min(24 * 30, b.hours === 0 ? 0 : (Number(b.hours) > 0 ? Number(b.hours) : 24)));
    const r = purgeOrphanMedia(hours);
    addLog({
      type: 'admin',
      userId: admin.id,
      username: admin.username,
      ip: req.ip,
      detail: '清理未关联媒体 ' + r.removed + ' 个（' + Math.round(r.bytes / 1024) + ' KB）'
    });
    return json(res, 200, { ok: true, removed: r.removed, bytes: r.bytes, hours: r.hours });
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

  /* ── 存储用量：视频 / 图片 / 其他文档 + 数据库 + 备份 ───────────── */
  if (pathname === '/api/admin/storage' && method === 'GET') {
    if (!requireAdmin(req, res)) return;
    return json(res, 200, storageInfo());
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

  if (method === 'GET' || method === 'HEAD') return serveStatic(pathname, req, res);
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
  '有被治愈到', '这种小事最顶用', '我也想这么过一天', '好会生活啊',
  '我上周也干过差不多的事', '这天气确实适合这样', '看完想出门走走了',
  '我这儿正好相反，一整天没停', '细节记这么清楚，是真的过了', '下次带我一个',
  '挺好，比刷手机强', '我也是这么想的', '这种事最能缓过来', '听着就很实在',
  '这手艺可以啊', '我还在犹豫要不要试', '这波操作我服', '说得我都饿了',
  '看着也替你高兴', '生活就是这样一点点攒起来的', '同款体验，完全懂'
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

/* 具体的感官细节：让同一类事件也能写出不同的句子 */
const BOT_DETAILS = [
  '手上还带着水汽', '锅盖被顶得哒哒响', '光斜过来照在桌角', '手指上沾了点面粉',
  '鞋跟敲在楼道里回响', '外面的风一直往里灌', '指尖凉了半天没缓过来',
  '窗台上落了一层细灰', '手机屏幕亮了一下又暗', '嗓子还有点哑',
  '米香从锅缝里飘出来', '脚底板终于落了地', '呼出的气在眼前散开',
  '楼下的猫蹲在台阶上看着我', '电视里在放听不懂的广告', '远处有人在敲东西'
];
const BOT_QUOTES = [
  '邻居阿姨说“这么早就出门啊”', '店老板问了句“还是老样子？”', '同事在群里发了张表情包',
  '我妈打电话问我吃了没', '前台说快递到了', '有人问要不要一起拼个单',
  '楼下修车的师傅跟我搭了句话', '小孩指着我的东西问那是什么'
];
const BOT_TAILS2 = [
  '就这样。', '也没什么特别的。', '记一下。', '先这样吧。', '挺好的。', '',
  '感觉还行。', '明天再看看。', '不折腾了。'
];

/* 人机本地语料：三种句型 + 感官细节 + 对话，组合空间很大，
   再加 persona（职业 / 城市 / 爱好）会让不同账号的句子明显不同。 */
function botSentence(persona) {
  const p = persona || {};
  const ev = randomOf(BOT_EVENTS);
  const mood = randomOf(BOT_MOODS);
  const detail = randomOf(BOT_DETAILS);
  const spice = randomOf(BOT_SPICE);
  const tail = randomOf(BOT_TAILS2);
  const r = Math.random();
  if (r < 0.3) {
    return randomOf(BOT_PREFIX) + ev + '，' + detail + '。' + mood + spice;
  }
  if (r < 0.55) {
    return randomOf(BOT_QUOTES) + '，我' + randomOf(BOT_PREFIX) + ev + '，' + mood + tail;
  }
  if (r < 0.78) {
    const like = Array.isArray(p.likes) && p.likes.length ? randomOf(p.likes) : '';
    const city = p.city || '';
    const job = p.job || '';
    const head = like ? '趁着休息把' + like + '弄了一阵，' : (job ? '下了' + job.slice(0, 4) + '的班，' : '');
    return head + randomOf(BOT_PREFIX) + ev + '，' + detail + (city ? '，' + city + '这边天已经黑了' : '') + '。' + mood;
  }
  return randomOf(BOT_PREFIX) + ev + '，' + mood + tail;
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

/* 最近若干条「机器发的」公开帖正文：人机 / AI 人机同时发帖时，用来避免句子撞车 */
function machineRecentTexts(limit = 14) {
  try {
    return db
      .prepare('SELECT text FROM posts WHERE private = 0 AND (bot = 1 OR ai = 1) ORDER BY id DESC LIMIT ?')
      .all(limit)
      .map((r) => String(r.text || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  } catch (e) {
    return [];
  }
}

/* 文本撞车就重写一次；还撞就用另一套本地语料（不同账号的句子必须不一样） */
async function freshenMachinePost(text, avoid, build) {
  const s = String(text || '').trim();
  if (!s) return s;
  if (!aibot.tooSimilar(s, avoid, aibot.POST_GATE, aibot.POST_LCS).hit) return s;
  try {
    const again = await build(avoid.concat([s]));
    const t2 = String((again && again.text) || '').trim();
    if (t2 && !aibot.tooSimilar(t2, avoid, aibot.POST_GATE, aibot.POST_LCS).hit) return t2;
  } catch (e) {}
  for (let i = 0; i < 6; i += 1) {
    const t3 = botSentence();
    if (!aibot.tooSimilar(t3, avoid, aibot.POST_GATE, aibot.POST_LCS).hit) return t3;
  }
  return botSentence();
}

/* 最近若干条公开帖（带正文）：评论 / 点赞 / 转帖 / 回复都在这些帖子上发生 */
function botPublicPosts(limit = 60) {
  return db.prepare('SELECT id, text FROM posts WHERE private = 0 ORDER BY id DESC LIMIT ?').all(limit);
}

/* 最近若干条别人的评论（用于「回复」），带原帖正文与评论者昵称 */
function botCommentPool(limit = 40) {
  return db
    .prepare(
      'SELECT c.id AS id, c.post_id AS postId, c.text AS text, c.user_id AS userId, ' +
        'COALESCE(u.nickname, u.username) AS nickname, p.text AS postText ' +
        'FROM comments c JOIN posts p ON p.id = c.post_id JOIN users u ON u.id = c.user_id ' +
        'WHERE p.private = 0 ORDER BY c.id DESC LIMIT ?'
    )
    .all(limit);
}

/* 关注对象：优先真人（非人机、非管理员），没有就挑另一个人机，制造社区感 */
function botFollowTarget(botId) {
  const real = db
    .prepare(
      'SELECT id, nickname, username FROM users WHERE id <> ? AND COALESCE(is_bot, 0) = 0 ' +
        'AND COALESCE(is_admin, 0) = 0 ORDER BY RANDOM() LIMIT 1'
    )
    .get(botId);
  if (real) return real;
  return (
    db
      .prepare(
        'SELECT id, nickname, username FROM users WHERE id <> ? AND COALESCE(is_bot, 0) = 1 ' +
          'ORDER BY RANDOM() LIMIT 1'
      )
      .get(botId) || null
  );
}

/* AI 配置：每次动作读一次设置，管理台改完立刻生效 */
function aiCfg() {
  let s = {};
  try {
    s = getSettings();
  } catch (e) {
    s = {};
  }
  return {
    enabled: !!s.aiEnabled,
    base: s.aiBaseUrl || '',
    key: s.aiApiKey || '',
    model: s.aiModel || '',
    temp: Number(s.aiTemp) || 90,
    hint: s.aiPersonaHint || ''
  };
}

function botSleep(ms) {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, Math.max(0, ms));
    if (t.unref) t.unref();
  });
}

/* 两条动作之间停一会儿：真人不会一口气刷完 */
function botPace() {
  return botSleep(900 + Math.floor(Math.random() * 5200));
}

/* 单条动作：kind = post / comment / reply / like / repost / follow / dm
   文本一律先问 AI（带人设、带上下文），失败或未配置时自动回落到本地语料。
   返回 { ok, detail, text, via, author }；内部异常不往外抛。 */
async function botAction(kind, opts) {
  opts = opts || {};
  /* 全站开关关掉时，人机也不再发帖 / 转发 / 评论 */
  const site = getSettings();
  if ((kind === 'post' || kind === 'repost') && !site.allowPost) {
    return { ok: false, detail: '全站发帖已关闭，人机暂停发布' };
  }
  if ((kind === 'comment' || kind === 'reply') && !site.allowComment) {
    return { ok: false, detail: '全站评论已关闭，人机暂停评论' };
  }
  const cfg = aiCfg();
  const bot = pickBotUser();
  const persona = aibot.personaFor(bot);
  const who = bot.nickname || bot.username;

  if (kind === 'post') {
    const recent = botPublicPosts(8)
      .map((p) => String(p.text || '').replace(/\s+/g, ' ').slice(0, 50))
      .filter(Boolean);
    const avoid = machineRecentTexts(14);
    const r = await aibot.compose({ kind: 'post', cfg, persona, hint: cfg.hint, recent, ctx: { avoid }, fallback: botSentence(persona) });
    r.text = await freshenMachinePost(r.text, avoid, (more) =>
      aibot.compose({ kind: 'post', cfg, persona, hint: cfg.hint, recent, ctx: { avoid: more }, fallback: '' })
    );
    const id = createPost({ userId: bot.id, text: r.text, private: false, sensitive: false, mediaIds: [], bot: true });
    addLog({
      type: 'bot', userId: bot.id, username: bot.username, ip: 'bot',
      detail: '人机发帖 #' + id + '（' + r.via + '）· ' + String(r.text).slice(0, 40)
    });
    return { ok: true, detail: '发帖 #' + id, text: r.text, via: r.via, author: who };
  }

  if (kind === 'comment' || kind === 'reply') {
    if (kind === 'reply') {
      const pool = botCommentPool(40).filter((c) => Number(c.userId) !== Number(bot.id));
      if (!pool.length) return { ok: false, detail: '还没有可回复的评论' };
      const target = randomOf(pool);
      const r = await aibot.compose({
        kind: 'reply', cfg, persona, hint: cfg.hint,
        ctx: { postText: target.postText, targetText: target.text, targetName: target.nickname },
        fallback: botCommentText()
      });
      addComment(target.postId, bot.id, r.text, target.id, true);
      addLog({
        type: 'bot', userId: bot.id, username: bot.username, ip: 'bot',
        detail: '人机回复 #' + target.id + '（' + r.via + '）· ' + String(r.text).slice(0, 40)
      });
      return { ok: true, detail: '回复评论 #' + target.id + '（帖子 #' + target.postId + '）', text: r.text, via: r.via, author: who };
    }
    const posts = botPublicPosts(60);
    if (!posts.length) return { ok: false, detail: '还没有可评论的帖子' };
    const target = randomOf(posts);
    const r = await aibot.compose({
      kind: 'comment', cfg, persona, hint: cfg.hint,
      ctx: { postText: target.text }, fallback: botCommentText()
    });
    addComment(target.id, bot.id, r.text, undefined, true);
    addLog({
      type: 'bot', userId: bot.id, username: bot.username, ip: 'bot',
      detail: '人机评论 帖子 #' + target.id + '（' + r.via + '）· ' + String(r.text).slice(0, 40)
    });
    return { ok: true, detail: '评论 帖子 #' + target.id, text: r.text, via: r.via, author: who };
  }

  if (kind === 'like') {
    const posts = botPublicPosts(60);
    if (!posts.length) return { ok: false, detail: '还没有可点赞的帖子' };
    for (let i = 0; i < 4 && posts.length; i += 1) {
      const target = randomOf(posts);
      const liked = db.prepare('SELECT 1 AS x FROM likes WHERE post_id = ? AND user_id = ?').get(target.id, bot.id);
      if (liked) continue; /* 点过就不再点，避免 toggle 掉 */
      toggleLike(target.id, bot.id);
      addLog({
        type: 'bot', userId: bot.id, username: bot.username, ip: 'bot',
        detail: '人机点赞 帖子 #' + target.id
      });
      return { ok: true, detail: '点赞 帖子 #' + target.id, author: who };
    }
    return { ok: false, detail: '能点的都点过了' };
  }

  if (kind === 'repost') {
    const posts = botPublicPosts(60);
    for (let i = 0; i < 4 && posts.length; i += 1) {
      const target = randomOf(posts);
      const dup = db.prepare('SELECT 1 AS x FROM reposts WHERE post_id = ? AND user_id = ?').get(target.id, bot.id);
      if (dup) continue; /* 已转过就换一条 */
      toggleRepost(target.id, bot.id);
      addLog({
        type: 'bot', userId: bot.id, username: bot.username, ip: 'bot',
        detail: '人机转帖 帖子 #' + target.id
      });
      return { ok: true, detail: '转帖 #' + target.id, author: who };
    }
    return { ok: false, detail: '没有可转的帖子' };
  }

  if (kind === 'follow') {
    const target = botFollowTarget(bot.id);
    if (!target) return { ok: false, detail: '没有可关注的对象' };
    const exists = db
      .prepare('SELECT 1 AS x FROM follows WHERE follower_id = ? AND followed_id = ?')
      .get(bot.id, target.id);
    if (exists) return { ok: false, detail: '已经关注过 ' + (target.nickname || target.username) };
    toggleFollow(bot.id, target.id);
    addLog({
      type: 'bot', userId: bot.id, username: bot.username, ip: 'bot',
      detail: '人机关注 ' + (target.nickname || target.username)
    });
    return { ok: true, detail: '关注 ' + (target.nickname || target.username), author: who };
  }

  if (kind === 'dm') {
    const targets = botDmTargets(20).filter((t) => Number(t.id) !== Number(bot.id));
    if (!targets.length) return { ok: false, detail: '还没有可私信的真实用户' };
    const target = randomOf(targets);
    const last = db
      .prepare('SELECT text FROM posts WHERE user_id = ? AND private = 0 ORDER BY id DESC LIMIT 1')
      .get(target.id);
    const r = await aibot.compose({
      kind: 'dm', cfg, persona, hint: cfg.hint,
      ctx: { postText: (last && last.text) || '' }, fallback: botDmText()
    });
    sendMessage(bot.id, target.id, r.text);
    addLog({
      type: 'bot', userId: bot.id, username: bot.username, ip: 'bot',
      detail: '人机私信 -> 用户 ' + (target.nickname || target.username) + '（' + r.via + '）'
    });
    return { ok: true, detail: '私信 ' + (target.nickname || target.username), text: r.text, via: r.via, author: who };
  }

  return { ok: false, detail: '未知动作 ' + kind };
}

/* 动作顺序：先有内容（发帖），再互动（评论 / 回复 / 点赞 / 转帖 / 关注），最后私信 */
const BOT_KINDS = ['post', 'comment', 'reply', 'like', 'repost', 'follow', 'dm'];

/* ================= AI 人机（管理员创建，独立于本地模板人机） =================
   和 bot_01..bot_20 那批模板人机完全分开：账号是 users.ai = 1，
   有自己的头像、人设、智商（0-100），可以开关，只能由管理员创建。
   动作：发帖 / 发图 / 发视频 / 网上找图发 / 评论（可看图文视频）/ 回复 / 点赞 / 转帖 / 关注 / 私信。 */
const AI_BOT_MAX = 30;
const AI_PERSONA_DEFAULT = '热爱生活的普通用户，喜欢随手记录';

/* 随机昵称：像真人一样（前缀+名词 / 双字名 / 小清新 ID），管理台留空就用这个 */
const AI_NICK_PRE = ['夜跑', '下班', '周五', '深夜', '爱拍', '早八', '摸鱼', '散步', '宅家', '雨天', '山顶', '城市', '海边', '地铁', '楼顶', '旧巷', '清晨', '周末', '春日', '秋夜', '加班', '赶车', '阳台', '午后'];
const AI_NICK_TAIL = ['的小林', '的阿哲', '的小满', '的猫', '的风', '的月亮', '的咖啡', '的相机', '的鱼', '的云', '的橘猫', '的柚子', '的柠檬', '的胖橘', '的猫薄荷', '的路灯', '的耳机', '的泡面', '的自行车'];
const AI_NICK_ONE = ['林小满', '陈屿', '阿柚', '南风', '沈迟', '许知', '阿岩', '木木', '七喜', '白桃', '小鹿', '阿岚', '橘子汽水', '风里有诗', '一只胖橘', '海盐苏打', '不太熟的桃子', '人间清醒小张', '半糖去冰', '今天也想躺平'];
function aiRandomNick() {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  for (let i = 0; i < 30; i += 1) {
    const name = Math.random() < 0.5 ? pick(AI_NICK_PRE) + pick(AI_NICK_TAIL) : pick(AI_NICK_ONE);
    const taken = db.prepare('SELECT 1 FROM users WHERE nickname = ?').get(name);
    if (!taken) return name;
  }
  return '路人' + crypto.randomBytes(2).toString('hex');
}

function aiSettings() {
  let s = {};
  try {
    s = getSettings();
  } catch (e) {
    s = {};
  }
  return {
    enabled: !!s.aiEnabled,
    base: s.aiBaseUrl || '',
    key: s.aiApiKey || '',
    model: s.aiModel || '',
    temp: Number(s.aiTemp) || 90,
    hint: s.aiPersonaHint || '',
    iq: Number.isFinite(Number(s.aiIQ)) ? Number(s.aiIQ) : 70,
    autoAvatar: s.aiAutoAvatar !== false,
    vision: !!s.aiVision,
    visionBase: s.aiVisionBase || '',
    visionKey: s.aiVisionKey || '',
    visionModel: s.aiVisionModel || '',
    commentOfficial: !!s.aiCommentOfficial,
    imageGen: !!s.aiImageGen,
    imageProvider: s.aiImageProvider || 'pollinations',
    imageBase: s.aiImageBase || '',
    imageKey: s.aiImageKey || '',
    imageModel: s.aiImageModel || '',
    imageSize: s.aiImageSize || '1024x1024',
    videoGen: !!s.aiVideoGen,
    postText: Math.max(0, Number(s.aiPostText) || 0),
    postImage: Math.max(0, Number(s.aiPostImage) || 0),
    postVideo: Math.max(0, Number(s.aiPostVideo) || 0),
    webMedia: !!s.aiWebMedia,
    webUrls: s.aiWebMediaUrls || '',
    webKey: s.aiWebMediaKey || '',
    autoEvery: Math.max(0, Number(s.aiAutoEverySec) || 0),
    autoPer: Math.max(0, Number(s.aiAutoPerRound) || 0),
    replyHuman: s.aiReplyHuman !== false,
    replyGuest: s.aiReplyGuest !== false,
    replyAi: s.aiReplyAi !== false,
    replyAiChance: Math.max(0, Math.min(100, Number(s.aiReplyAiChance) || 0)),
    replyAiMax: Math.max(0, Math.min(10, Number(s.aiReplyAiMax) || 0)),
    replyFast: s.aiReplyFast !== false,
    replyPerPost: Math.max(0, Number(s.aiReplyPerPost) || 0)
  };
}

function aiTextCfg(s) {
  return { enabled: s.enabled, base: s.base, key: s.key, model: s.model, temp: s.temp, hint: s.hint };
}

/* 看图配置：单独填了用单独的（Qwen-VL / 豆包 / GPT-4o 等），没填就沿用主模型 */
function aiVisionCfg(s) {
  if (!s.vision) return null;
  const base = s.visionBase || s.base;
  const key = s.visionKey || s.key;
  const model = s.visionModel || s.model;
  if (!base || !key || !model) return null;
  return { enabled: true, base, key, model, temp: s.temp, hint: s.hint };
}

function aiImageCfg(s) {
  return { provider: s.imageProvider, base: s.imageBase, key: s.imageKey, model: s.imageModel };
}

function aiUsers() {
  try {
    return db
      .prepare(
        'SELECT id, username, nickname, avatar, ai_persona, ai_iq, ai_manner, ai_enabled, created_at FROM users ' +
          'WHERE COALESCE(ai, 0) = 1 AND COALESCE(is_admin, 0) = 0 ORDER BY id ASC'
      )
      .all();
  } catch (e) {
    return [];
  }
}

function aiUserById(id) {
  const n = Number(id) || 0;
  if (!n) return null;
  return (
    db
      .prepare(
        'SELECT id, username, nickname, avatar, ai_persona, ai_iq, ai_manner, ai_enabled, created_at FROM users ' +
          'WHERE id = ? AND COALESCE(ai, 0) = 1'
      )
      .get(n) || null
  );
}

function aiPickBot(id) {
  if (id) {
    const one = aiUserById(id);
    return one && Number(one.ai_enabled) ? one : null;
  }
  const list = aiUsers().filter((u) => Number(u.ai_enabled));
  return list.length ? randomOf(list) : null;
}

/* ---- 头像：不依赖字体和网络，用确定性配色画一张 256x256 的 PNG ---- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(Math.min(k(n) - 3, 9 - k(n)), 1));
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}

function makeAvatarPng(key) {
  const S = 256;
  const raw = Buffer.alloc(S * (S * 3 + 1));
  const seed = String(key || '');
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const hue = h % 360;
  const hue2 = (hue + 40 + (h >>> 9) % 80) % 360;
  const c1 = hslToRgb(hue, 0.62, 0.56);
  const c2 = hslToRgb(hue2, 0.72, 0.42);
  const blobs = [];
  for (let i = 0; i < 3; i += 1) {
    blobs.push({
      x: 40 + ((h >>> (i * 5 + 3)) % 176),
      y: 40 + ((h >>> (i * 7 + 1)) % 176),
      r: 46 + ((h >>> (i * 3 + 5)) % 54),
      a: 0.14 + 0.08 * i
    });
  }
  let p = 0;
  for (let y = 0; y < S; y += 1) {
    raw[p] = 0;
    p += 1;
    for (let x = 0; x < S; x += 1) {
      const t = (x + y) / (2 * S);
      let r = c1[0] + (c2[0] - c1[0]) * t;
      let g = c1[1] + (c2[1] - c1[1]) * t;
      let b = c1[2] + (c2[2] - c1[2]) * t;
      for (let i = 0; i < blobs.length; i += 1) {
        const bl = blobs[i];
        const d = Math.sqrt((x - bl.x) * (x - bl.x) + (y - bl.y) * (y - bl.y));
        if (d < bl.r) {
          const k = (1 - d / bl.r) * bl.a;
          r = r + (255 - r) * k;
          g = g + (255 - g) * k;
          b = b + (255 - b) * k;
        }
      }
      const edge = Math.min(x, y, S - 1 - x, S - 1 - y);
      if (edge < 6) {
        const k = 0.22 * (1 - edge / 6);
        r = r * (1 - k);
        g = g * (1 - k);
        b = b * (1 - k);
      }
      raw[p] = Math.max(0, Math.min(255, Math.round(r)));
      raw[p + 1] = Math.max(0, Math.min(255, Math.round(g)));
      raw[p + 2] = Math.max(0, Math.min(255, Math.round(b)));
      p += 3;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0);
  ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

/* 把一段二进制存成媒体文件并入库（AI 生成的内容 ai=1） */
function aiUploadMedia(buf, mime, bot, filename) {
  const id = crypto.randomBytes(12).toString('hex');
  const file = path.join(MEDIA_DIR, id);
  fs.writeFileSync(file, buf);
  recordMedia({ id, userId: bot.id, filename: String(filename || 'ai').slice(-60), mime: mime || 'image/jpeg', size: buf.length, bot: true });
  try {
    db.prepare('UPDATE media SET ai = 1 WHERE id = ?').run(id);
  } catch (e) {
    /* 老库没这列也不影响使用 */
  }
  return { id, url: '/media/' + id };
}

/* 网上找头像：中国人最常当头像的几类 —— 猫狗、花、风景、天空、美食、街景 */
const AI_AVATAR_WORDS = ['cat', 'kitten', 'dog', 'puppy', 'rabbit', 'panda', 'flower', 'blossom', 'landscape',
  'mountain', 'lake', 'sea', 'beach', 'sky', 'cloud', 'sunset', 'forest', 'autumn', 'snow', 'street',
  'coffee', 'tea', 'dessert', 'food'];

/* 网图统一压成 256x256 居中裁切 jpg，头像不吃带宽也不占地方 */
async function aiShrinkAvatar(buf) {
  const tag = crypto.randomBytes(5).toString('hex');
  const inF = path.join(UPLOAD_TMP_DIR, 'av-' + tag + '.bin');
  const outF = path.join(UPLOAD_TMP_DIR, 'av-' + tag + '.jpg');
  try {
    fs.mkdirSync(UPLOAD_TMP_DIR, { recursive: true });
    fs.writeFileSync(inF, buf);
    await runFfmpeg(['-hide_banner', '-loglevel', 'error', '-y', '-i', inF,
      '-vf', 'scale=256:256:force_original_aspect_ratio=increase,crop=256:256',
      '-frames:v', '1', '-q:v', '3', outF], 30000);
    const small = fs.readFileSync(outF);
    return small && small.length > 1024 ? { buf: small, mime: 'image/jpeg' } : null;
  } catch (e) {
    return null;
  } finally {
    try { if (fs.existsSync(inF)) fs.unlinkSync(inF); } catch (e) { /* 清不掉不算错 */ }
    try { if (fs.existsSync(outF)) fs.unlinkSync(outF); } catch (e) { /* 清不掉不算错 */ }
  }
}

/* 从免费图库抓一张（loremflickr 按关键词，抓不到就 picsum 随机照片） */
async function aiWebAvatar() {
  const tries = [];
  const word = AI_AVATAR_WORDS[Math.floor(Math.random() * AI_AVATAR_WORDS.length)];
  tries.push('https://loremflickr.com/512/512/' + word + '?lock=' + Math.floor(Math.random() * 1e6));
  tries.push('https://picsum.photos/seed/u' + Math.floor(Math.random() * 1e9) + '/512/512');
  for (let i = 0; i < tries.length; i += 1) {
    try {
      const got = await aibot.downloadBinary(tries[i], {}, 12000);
      if (!got || !got.buf || got.buf.length < 2048) continue;
      const small = await aiShrinkAvatar(got.buf);
      if (small) return small;
    } catch (e) {
      /* 换下一个源 */
    }
  }
  return null;
}

/* 给 AI 人机换头像（autoAvatar 打开时创建 / 重建都走这里）：一半网上找、一半本地画 */
async function aiRefreshAvatar(bot, customBuf) {
  let buf = customBuf && customBuf.length ? customBuf : null;
  let mime = 'image/png';
  let name = 'avatar-' + bot.username + '.png';
  if (!buf && Math.random() < 0.5) {
    try {
      const got = await aiWebAvatar();
      if (got) {
        buf = got.buf;
        mime = got.mime;
        name = 'avatar-' + bot.username + '.jpg';
      }
    } catch (e) {
      /* 抓不到就退回本地画，不影响建号 */
    }
  }
  if (!buf) {
    buf = makeAvatarPng(bot.username + ':' + bot.nickname + ':' + bot.id + ':' + Date.now());
    mime = 'image/png';
    name = 'avatar-' + bot.username + '.png';
  }
  const up = aiUploadMedia(buf, mime, bot, name);
  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(up.url, bot.id);
  return up.url;
}

/* ---- 发帖：挑一条能看懂的可视内容给 AI 看（图片优先用 720p 缩略图，视频用封面） ---- */
/* 看内容：图片取 720p 缩略图（没有就现生成），视频取封面帧（没有就现截一帧）
   两种都压成 jpeg dataURL 交给视觉模型，AI 评论时是真的「看过」再说话。 */
function aiThumbOf(id, src) {
  return new Promise((resolve) => {
    try {
      ensureThumb(id, src, (err, out) => resolve(err || !out ? '' : out));
    } catch (e) {
      resolve('');
    }
  });
}

async function aiShots(postId, maxN) {
  const out = [];
  let rows = [];
  try {
    rows = db.prepare('SELECT id, mime, size, poster, user_id FROM media WHERE post_id = ? ORDER BY rowid ASC').all(postId);
  } catch (e) {
    rows = [];
  }
  for (const m of rows) {
    let file = '';
    const src = path.join(MEDIA_DIR, m.id);
    let has = false;
    try { has = fs.existsSync(src); } catch (e) { has = false; }
    if (/^image\//.test(m.mime) && has) {
      file = await aiThumbOf(m.id, src);
      if (!file && Number(m.size) <= 3 * 1024 * 1024) file = src;
    } else if (/^video\//.test(m.mime) && has) {
      let poster = m.poster || '';
      let posterOk = false;
      try { posterOk = !!poster && fs.existsSync(path.join(MEDIA_DIR, poster)); } catch (e) { posterOk = false; }
      if (!posterOk) {
        try { autoVideoPoster(m.id, m.user_id || 1, src); } catch (e) { /* 截不出来就算了 */ }
        for (let i = 0; i < 12 && !posterOk; i += 1) {
          await new Promise((r) => setTimeout(r, 600));
          const row = db.prepare('SELECT poster FROM media WHERE id = ?').get(m.id);
          poster = (row && row.poster) || '';
          try { posterOk = !!poster && fs.existsSync(path.join(MEDIA_DIR, poster)); } catch (e) { posterOk = false; }
        }
      }
      if (posterOk) {
        const p = path.join(MEDIA_DIR, poster);
        const t = await aiThumbOf(poster, p);
        file = t || p;
      }
    }
    if (!file) continue;
    try {
      if (!fs.existsSync(file)) continue;
      const buf = fs.readFileSync(file);
      if (!buf.length || buf.length > 2 * 1024 * 1024) continue;
      out.push('data:image/jpeg;base64,' + buf.toString('base64'));
    } catch (e) {
      /* 读不到就跳过 */
    }
    if (out.length >= (maxN || 3)) break;
  }
  return out;
}

/* 评论对象：勾了「优先评论 U 官方」就先在官方 / 管理员帖里挑 */
function aiPickTargetPost(s) {
  if (s.commentOfficial) {
    const off = db
      .prepare(
        'SELECT p.id, p.text, p.user_id FROM posts p JOIN users u ON u.id = p.user_id ' +
          "WHERE p.private = 0 AND (u.username = 'u_official' OR COALESCE(u.is_admin, 0) = 1) ORDER BY p.id DESC LIMIT 30"
      )
      .all();
    if (off.length) {
      /* 已经评过的跳过，避免同一条帖反复刷 */
      const fresh = off.filter((p) => !db.prepare('SELECT 1 AS x FROM comments c JOIN users u ON u.id = c.user_id WHERE c.post_id = ? AND COALESCE(u.ai, 0) = 1').get(p.id));
      return (fresh.length ? randomOf(fresh) : randomOf(off));
    }
  }
  const all = botPublicPosts(60);
  return all.length ? randomOf(all) : null;
}

/* 发帖配比：纯文字 / 图片 / 视频 三个权重（管理台可调），没开对应能力的按 0 算 */
function aiPickMode(s) {
  const canImage = !!(s.imageGen || s.webMedia);
  const canVideo = !!s.videoGen;
  const rows = [
    ['text', Math.max(0, Number(s.postText) || 0)],
    ['image', canImage ? Math.max(0, Number(s.postImage) || 0) : 0],
    ['video', canVideo ? Math.max(0, Number(s.postVideo) || 0) : 0]
  ];
  const total = rows.reduce((n, r) => n + r[1], 0);
  if (!total) return 'text';
  let hit = 'text';
  let r = Math.random() * total;
  for (let i = 0; i < rows.length; i += 1) {
    if (r < rows[i][1]) { hit = rows[i][0]; break; }
    r -= rows[i][1];
  }
  if (hit === 'image') {
    /* 图片帖再细分：自己画 / 上网找，两个都开就按 6:4 */
    if (s.imageGen && s.webMedia) return Math.random() < 0.6 ? 'image' : 'webmedia';
    return s.imageGen ? 'image' : 'webmedia';
  }
  return hit;
}

function runFfmpeg(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(FFMPEG_BIN, args, { timeout: timeoutMs || 180000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(String((stderr || err.message || '') ).slice(-200)));
      resolve(stdout);
    });
  });
}

/* 把 3 张图拼成 6 秒竖屏视频（AI 自己「拍」的视频） */
async function aiMakeVideo(files) {
  const tmpDir = path.join(DATA_DIR, 'tmp-uploads');
  try {
    fs.mkdirSync(tmpDir, { recursive: true });
  } catch (e) {
    /* 已存在 */
  }
  const tag = crypto.randomBytes(4).toString('hex');
  const ins = [];
  files.slice(0, 3).forEach((buf, i) => {
    const f = path.join(tmpDir, 'ai-' + tag + '-' + i + '.jpg');
    fs.writeFileSync(f, buf);
    ins.push(f);
  });
  if (!ins.length) throw new Error('没有可用的图片');
  const out = path.join(tmpDir, 'ai-' + tag + '.mp4');
  const args = ['-hide_banner', '-loglevel', 'error', '-y'];
  ins.forEach((f) => {
    args.push('-loop', '1', '-t', '2', '-i', f);
  });
  const filters = ins
    .map((f, i) => '[' + i + ':v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1[v' + i + ']')
    .join(';');
  const cat = ins.map((f, i) => '[v' + i + ']').join('') + 'concat=n=' + ins.length + ':v=1:a=0[out]';
  args.push('-filter_complex', filters + ';' + cat, '-map', '[out]', '-r', '25', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out);
  await runFfmpeg(args, 240000);
  const buf = fs.readFileSync(out);
  try {
    fs.unlinkSync(out);
    ins.forEach((f) => fs.unlinkSync(f));
  } catch (e) {
    /* 清理失败无所谓 */
  }
  if (!buf.length) throw new Error('视频合成失败');
  return buf;
}

/* 单条 AI 动作 */
/* ---- 真人来互动：AI 读懂整段对话再回话 -------------------------------------------------
   触发：真人在 AI 人机的帖子下评论，或者回复了 AI 的某条评论。
   aiReplyFast = 开：真人一说话就回，不排队、不受人机之间的间隔限制；
   aiReplyFast = 关：按正常节奏等 3~8 秒再回。
   aiReplyPerPost：同一条帖子每个 AI 最多回几条（30 分钟窗口），防止和一个人互刷。 */
const AI_HUMAN_HITS = new Map(); /* "botId:postId" -> [{ cid, ts }] */

function aiHumanQuota(botId, postId, cid, limit) {
  const key = botId + ':' + postId;
  const now = Date.now();
  const hits = (AI_HUMAN_HITS.get(key) || []).filter((x) => now - x.ts < 30 * 60 * 1000);
  if (hits.some((x) => x.cid === cid)) return false;
  if (limit > 0 && hits.length >= limit) return false;
  hits.push({ cid, ts: now });
  AI_HUMAN_HITS.set(key, hits);
  if (AI_HUMAN_HITS.size > 500) AI_HUMAN_HITS.clear();
  return true;
}

/* AI 之间的你来我往：沿 reply_to 往上数，链里已经有几条 AI 的发言 */
function aiChainCount(commentId) {
  let cur = Number(commentId) || 0;
  let steps = 0;
  let aiCount = 0;
  while (cur && steps < 30) {
    const c = db.prepare('SELECT id, user_id, reply_to FROM comments WHERE id = ?').get(cur);
    if (!c) break;
    const u = db.prepare('SELECT COALESCE(ai,0) AS ai FROM users WHERE id = ?').get(c.user_id);
    if (u && u.ai) aiCount += 1;
    cur = Number(c.reply_to) || 0;
    steps += 1;
  }
  return aiCount;
}

/* 有人在评论里 @ 了 AI：过一会儿让 AI 读完整个评论区再接一句（不阻塞发评论的人） */
function scheduleAiReply(postId, commentId, s, delayMs) {
  try {
    const t = setTimeout(function () {
      aiReplyToHuman(postId, commentId, s).catch(function () {});
    }, Math.max(200, Number(delayMs) || 900));
    if (t.unref) t.unref();
  } catch (e) {
    /* 忽略：排期失败不影响主流程 */
  }
}

async function aiReplyToHuman(postId, commentId, s) {
  try {
    const pid = Number(postId) || 0;
    const cid = Number(commentId) || 0;
    if (!pid || !cid || !s) return null;
    /* 总开关关掉后谁说话都不回 */
    if (!s.enabled) return null;
    /* 全站评论关掉时，AI 人机也不许接话 */
    if (!getSettings().allowComment) return null;
    const cm = db.prepare('SELECT id, user_id, text, reply_to FROM comments WHERE id = ? AND post_id = ?').get(cid, pid);
    if (!cm) return null;
    const hu = db
      .prepare('SELECT id, username, nickname, COALESCE(ai,0) AS ai, COALESCE(is_bot,0) AS bot, COALESCE(is_guest,0) AS guest FROM users WHERE id = ?')
      .get(cm.user_id);
    if (!hu) return null;
    /* 谁能触发 AI 回话：真人 / 游客 / 别的 AI 人机；本地人机（bot_xx）由人机引擎自己管，这里不回 */
    let role = 'user';
    if (hu.ai) role = 'ai';
    else if (hu.bot) role = 'bot';
    else if (hu.guest) role = 'guest';
    if (role === 'bot') return null;
    if (role === 'ai') {
      if (!s.replyAi) return null;
      /* AI 回 AI 是概率事件，默认 30% */
      if (Math.random() * 100 >= Math.max(0, Math.min(100, Number(s.replyAiChance) || 0))) return null;
      /* 一条对话链里 AI 最多说 N 句，防止两个 AI 自己刷起来 */
      if (aiChainCount(cid) >= Math.max(1, Number(s.replyAiMax) || 3)) return null;
    } else if (role === 'guest') {
      if (!s.replyGuest) return null;
    } else if (!s.replyHuman) {
      return null;
    }
    const post = db.prepare('SELECT id, user_id, text FROM posts WHERE id = ?').get(pid);
    if (!post) return null;
    /* 谁被@了：优先「被回复的那条评论的作者」，其次「帖子的作者」 */
    let botRow = null;
    if (cm.reply_to) {
      const par = db.prepare('SELECT user_id FROM comments WHERE id = ?').get(cm.reply_to);
      if (par) botRow = aiUserById(par.user_id);
    }
    if (!botRow && post.user_id) botRow = aiUserById(post.user_id);
    /* 帖主不是 AI 时：只要说话的是别的 AI 人机，就重新挑一个 AI 来接话（AI 之间互相搭话） */
    if (!botRow && role === 'ai') {
      const others = aiUsers().filter((u) => Number(u.id) !== Number(cm.user_id) && Number(u.ai_enabled));
      if (others.length) botRow = randomOf(others);
    }
    /* 真人 / 游客说话时：这个帖子里只要有 AI 人机参与过，就让最近说话的那个 AI 来接一句 */
    if (!botRow && (role === 'user' || role === 'guest')) {
      try {
        const lastAi = db
          .prepare(
            'SELECT c.user_id FROM comments c JOIN users u ON u.id = c.user_id ' +
              'WHERE c.post_id = ? AND COALESCE(u.ai,0) = 1 AND c.id != ? ORDER BY c.id DESC LIMIT 1'
          )
          .get(pid, cid);
        if (lastAi) botRow = aiUserById(lastAi.user_id);
      } catch (e) {
        /* 忽略：查不到就让这次不回复 */
      }
    }
    if (!botRow || !Number(botRow.ai_enabled)) return null;
    if (!aiHumanQuota(botRow.id, pid, cid, Math.max(0, Number(s.replyPerPost) || 0))) return null;
    if (!s.replyFast) await botSleep(3000 + Math.floor(Math.random() * 5000));

    let lines = [];
    try {
      lines = db
        .prepare(
          'SELECT c.id, c.text, c.user_id, u.nickname, u.username FROM comments c JOIN users u ON u.id = c.user_id ' +
            'WHERE c.post_id = ? ORDER BY c.id ASC LIMIT 40'
        )
        .all(pid)
        .map((r) => ({ name: r.nickname || r.username, text: r.text, mine: r.user_id === botRow.id }));
    } catch (e) {
      lines = [];
    }

    const vcfg = aiVisionCfg(s);
    let images = [];
    if (vcfg) {
      try {
        images = await aiShots(pid, 2);
      } catch (e) {
        images = [];
      }
    }
    const persona = { text: botRow.ai_persona || AI_PERSONA_DEFAULT, manner: Number.isFinite(Number(botRow.ai_manner)) ? Number(botRow.ai_manner) : 60 };
    const iq = Number.isFinite(Number(botRow.ai_iq)) ? Number(botRow.ai_iq) : 70;
    const r = await aibot.compose({
      kind: 'thread',
      cfg: images.length ? vcfg : aiTextCfg(s),
      persona,
      iq,
      ctx: { postText: post.text, lines, targetName: hu.nickname || hu.username, targetText: cm.text, images },
      fallback: ''
    });
    const text = String((r && r.text) || '').trim();
    if (!text) return null;
    const newReplyId = addComment(pid, botRow.id, text, cid, false, true);
    addLog({
      type: 'ai',
      ip: 'ai',
      detail: '@' + botRow.username + ' 回了 ' + (hu.nickname || hu.username) + '：' + text.slice(0, 60) + (r.via === 'ai' ? '（ai）' : '（本地语料）')
    });
    /* 这一句说完，别的 AI 人机可能接着搭话（30% 概率，同一条链最多 N 句） */
    scheduleAiReply(pid, newReplyId, s, 1500 + Math.floor(Math.random() * 2500));
    return text;
  } catch (e) {
    return null;
  }
}

async function aiAction(kind, botId, opts) {
  const manual = !!(opts && opts.manual);
  const s = aiSettings();
  /* 自动轮转 / 自动回话都受总开关控制；管理台点按钮试用（manual）不受影响 */
  if (!s.enabled && !manual) return { ok: false, detail: 'AI 生成已关闭' };
  /* 全站开关是硬闸：关掉后 AI 人机也不能发帖 / 评论，连手工试发也一起拦 */
  const site = getSettings();
  const isPostKind = kind === 'post' || kind === 'image' || kind === 'video' || kind === 'webmedia' || kind === 'repost';
  const isCommentKind = kind === 'comment' || kind === 'commentOfficial' || kind === 'reply';
  if (isPostKind && !site.allowPost) return { ok: false, detail: '全站发帖已关闭，AI 人机暂停发布' };
  if (isCommentKind && !site.allowComment) return { ok: false, detail: '全站评论已关闭，AI 人机暂停评论' };
  const bot = aiPickBot(botId);
  if (!bot) return { ok: false, detail: '还没有可用的 AI 人机（先在「AI 人机」里创建并启用）' };
  const cfg = aiTextCfg(s);
  const vcfg = aiVisionCfg(s);
  const persona = {
    text: bot.ai_persona || AI_PERSONA_DEFAULT,
    manner: Number.isFinite(Number(bot.ai_manner)) ? Number(bot.ai_manner) : 60
  };
  const iq = Number.isFinite(Number(bot.ai_iq)) ? Number(bot.ai_iq) : s.iq;
  const who = bot.nickname || bot.username;
  const fallbackPost = botSentence();
  const fallbackComment = botCommentText();

  if (kind === 'post' || kind === 'image' || kind === 'video' || kind === 'webmedia') {
    let mode = kind === 'post' ? aiPickMode(s) : kind;
    const recent = botPublicPosts(8)
      .map((p) => String(p.text || '').replace(/\s+/g, ' ').slice(0, 40))
      .filter(Boolean);
    /* 别的账号（人机 / AI 人机）刚发过的句子，一起拿去对照，避免内容雷同 */
    const avoid = machineRecentTexts(14);
    const aiPost = (more) =>
      aibot.compose({
        kind: 'post', cfg, persona, iq, recent,
        ctx: { avoid: more || avoid },
        fallback: more && more.length > avoid.length ? '' : fallbackPost
      });
    const mediaIds = [];
    let text = '';
    try {
      if (mode === 'image' || mode === 'video') {
        const idea = await aiPost();
        text = await freshenMachinePost(idea.text, avoid, aiPost);
        if (mode === 'video') {
          if (!fs.existsSync(FFMPEG_BIN)) throw new Error('服务器缺少 ffmpeg，无法合成视频');
          const bufs = [];
          for (let i = 0; i < 3; i += 1) {
            const g = await aibot.genImage(aiImageCfg(s), text, s.imageSize);
            bufs.push(g.buf);
          }
          const mp4 = await aiMakeVideo(bufs);
          mediaIds.push(aiUploadMedia(mp4, 'video/mp4', bot, 'ai-video.mp4').id);
        } else {
          const g = await aibot.genImage(aiImageCfg(s), text, s.imageSize);
          mediaIds.push(aiUploadMedia(g.buf, g.mime, bot, 'ai-image').id);
        }
      } else if (mode === 'webmedia') {
        const idea = await aiPost();
        text = await freshenMachinePost(idea.text, avoid, aiPost);
        /* 关键词由 AI 自己定，不让人填 */
        let kw = '';
        try { kw = await aibot.searchWords(cfg, text); } catch (e) {}
        kw = kw || 'daily life';
        const got = await aibot.fetchWebImage({ urls: s.webUrls, key: s.webKey }, kw);
        mediaIds.push(aiUploadMedia(got.buf, got.mime, bot, 'web-image').id);
      } else {
        const r = await aiPost();
        text = await freshenMachinePost(r.text, avoid, aiPost);
      }
    } catch (e) {
      return { ok: false, detail: '生成失败：' + String((e && e.message) || e).slice(0, 120) };
    }
    const id = createPost({ userId: bot.id, text: String(text || '').slice(0, 600), private: false, sensitive: false, mediaIds, bot: false, ai: true });
    if (mediaIds.length) {
      /* 生成图也要有封面，不然信息流只显示占位 */
      autoVideoPosterForAi(mediaIds[0]);
    }
    addLog({
      type: 'ai', userId: bot.id, username: bot.username, ip: 'ai',
      detail: 'AI 人机发帖 #' + id + '（' + mode + '）· ' + String(text || '').slice(0, 40)
    });
    return { ok: true, detail: '发帖 #' + id + '（' + mode + '）', text: String(text || ''), via: 'ai', author: who };
  }

  if (kind === 'comment' || kind === 'commentOfficial' || kind === 'reply') {
    if (kind === 'reply') {
      const pool = botCommentPool(40).filter((c) => Number(c.userId) !== Number(bot.id));
      if (!pool.length) return { ok: false, detail: '还没有可回复的评论' };
      const target = randomOf(pool);
      const r = await aibot.compose({
        kind: 'reply', cfg, persona, iq,
        ctx: { postText: target.postText, targetText: target.text, targetName: target.nickname },
        fallback: fallbackComment
      });
      const newReplyId = addComment(target.postId, bot.id, r.text, target.id, false, true);
      addLog({ type: 'ai', userId: bot.id, username: bot.username, ip: 'ai', detail: 'AI 人机回复 #' + target.id + '（' + r.via + '）· ' + String(r.text).slice(0, 40) });
      scheduleAiReply(target.postId, newReplyId, s, 1500 + Math.floor(Math.random() * 2500));
      return { ok: true, detail: '回复评论 #' + target.id + '（帖子 #' + target.postId + '）', text: r.text, via: r.via, author: who };
    }
    const target = aiPickTargetPost(s);
    if (!target) return { ok: false, detail: '还没有可评论的帖子' };
    const shots = vcfg ? await aiShots(target.id, 3) : [];
    const r = await aibot.compose({
      kind: 'comment',
      cfg: shots.length ? vcfg : cfg,
      persona, iq,
      ctx: { postText: target.text, images: shots },
      fallback: fallbackComment
    });
    const newCommentId = addComment(target.id, bot.id, r.text, undefined, false, true);
    addLog({
      type: 'ai', userId: bot.id, username: bot.username, ip: 'ai',
      detail: 'AI 人机评论 帖子 #' + target.id + (shots.length ? '（看图）' : '') + '（' + r.via + '）· ' + String(r.text).slice(0, 40)
    });
    scheduleAiReply(target.id, newCommentId, s, 1500 + Math.floor(Math.random() * 2500));
    return { ok: true, detail: '评论 帖子 #' + target.id + (shots.length ? '（带图理解）' : ''), text: r.text, via: r.via, author: who };
  }

  if (kind === 'like' || kind === 'repost') {
    const posts = botPublicPosts(60);
    if (!posts.length) return { ok: false, detail: '还没有可互动的帖子' };
    for (let i = 0; i < 4 && posts.length; i += 1) {
      const target = randomOf(posts);
      const table = kind === 'like' ? 'likes' : 'reposts';
      const done = db.prepare('SELECT 1 AS x FROM ' + table + ' WHERE post_id = ? AND user_id = ?').get(target.id, bot.id);
      if (done) continue;
      if (kind === 'like') toggleLike(target.id, bot.id);
      else toggleRepost(target.id, bot.id);
      addLog({ type: 'ai', userId: bot.id, username: bot.username, ip: 'ai', detail: 'AI 人机' + (kind === 'like' ? '点赞' : '转帖') + ' 帖子 #' + target.id });
      return { ok: true, detail: (kind === 'like' ? '点赞' : '转帖') + ' 帖子 #' + target.id, author: who };
    }
    return { ok: false, detail: '能做的都做过了' };
  }

  if (kind === 'follow') {
    const target = botFollowTarget(bot.id);
    if (!target) return { ok: false, detail: '没有可关注的对象' };
    const exists = db.prepare('SELECT 1 AS x FROM follows WHERE follower_id = ? AND followed_id = ?').get(bot.id, target.id);
    if (exists) return { ok: false, detail: '已经关注过 ' + (target.nickname || target.username) };
    toggleFollow(bot.id, target.id);
    addLog({ type: 'ai', userId: bot.id, username: bot.username, ip: 'ai', detail: 'AI 人机关注 ' + (target.nickname || target.username) });
    return { ok: true, detail: '关注 ' + (target.nickname || target.username), author: who };
  }

  if (kind === 'dm') {
    const targets = botDmTargets(20).filter((t) => Number(t.id) !== Number(bot.id));
    if (!targets.length) return { ok: false, detail: '还没有可私信的用户' };
    const target = randomOf(targets);
    const last = db.prepare('SELECT text FROM posts WHERE user_id = ? AND private = 0 ORDER BY id DESC LIMIT 1').get(target.id);
    const r = await aibot.compose({
      kind: 'dm', cfg, persona, iq,
      ctx: { postText: (last && last.text) || '' },
      fallback: botDmText()
    });
    sendMessage(bot.id, target.id, r.text);
    addLog({ type: 'ai', userId: bot.id, username: bot.username, ip: 'ai', detail: 'AI 人机私信 -> ' + (target.nickname || target.username) + '（' + r.via + '）' });
    return { ok: true, detail: '私信 ' + (target.nickname || target.username), text: r.text, via: r.via, author: who };
  }

  return { ok: false, detail: '未知 AI 动作 ' + kind };
}

/* AI 生成的图片帖也要有 poster：直接借 autoVideoPoster（它只处理视频）之外的方式——
   图片帖本来就用原图当封面，这里只在是视频时补抽帧 */
function autoVideoPosterForAi(mediaId) {
  try {
    const row = db.prepare('SELECT id, mime, user_id FROM media WHERE id = ?').get(mediaId);
    if (!row || !/^video\//.test(row.mime)) return;
    const file = path.join(MEDIA_DIR, row.id);
    autoVideoPoster(row.id, row.user_id || 1, file);
  } catch (e) {
    /* 抽不到封面不影响发布 */
  }
}

const AI_KINDS = ['post', 'image', 'video', 'webmedia', 'comment', 'commentOfficial', 'reply', 'like', 'repost', 'follow', 'dm'];

/* AI 人机自动轮转（设置里 aiAutoEverySec > 0 才跑） */
let aiTimer = null;
function restartAiEngine() {
  if (aiTimer) {
    try { clearTimeout(aiTimer); } catch (e) { /* 已停 */ }
    aiTimer = null;
  }
  const s = aiSettings();
  /* 总开关关掉就彻底停：不再自动轮转（回话也会在 aiReplyToHuman 里被挡住） */
  if (!s.enabled) {
    console.log('[AI 人机] 已关闭（启用 AI 生成 = 关），自动轮转停止');
    return;
  }
  if (!s.autoEvery || !s.autoPer) {
    console.log('[AI 人机] 自动轮转为关闭状态');
    return;
  }
  const arm = () => {
    const wait = Math.max(5000, Math.round(s.autoEvery * 1000 * (0.7 + Math.random() * 0.6)));
    aiTimer = setTimeout(async () => {
      try {
        if (!aiUsers().length) {
          /* 没有账号就不空转 */
        } else {
          const kinds = ['post', 'comment', 'like', 'follow'];
          for (let i = 0; i < Math.min(20, s.autoPer); i += 1) {
            const kind = randomOf(kinds);
            try {
              const out = await aiAction(kind);
              if (!out.ok) console.log('[AI 人机] ' + kind + ' 跳过：' + out.detail);
            } catch (e) {
              console.error('[AI 人机] ' + kind + ' 失败：' + (e && e.message));
            }
            if (i < s.autoPer - 1) await botSleep(2000 + Math.floor(Math.random() * 4000));
          }
        }
      } catch (e) {
        console.error('[AI 人机] 轮转异常：' + (e && e.message));
      }
      arm();
    }, wait);
    if (aiTimer.unref) aiTimer.unref();
  };
  arm();
  console.log('[AI 人机] 自动轮转已启动：约 ' + s.autoEvery + ' 秒一批 ' + s.autoPer + ' 条');
}

/* 执行一轮：counts = { post, comment, reply, like, repost, follow, dm }，表示本轮各自做几条 */
async function botRound(counts) {
  counts = counts || {};
  botTickCount += 1;
  for (const kind of BOT_KINDS) {
    const n = botRoundCount(counts[kind]);
    for (let i = 0; i < n; i += 1) {
      try {
        const out = await botAction(kind);
        if (!out.ok) console.log('[人机] ' + kind + ' 跳过：' + out.detail);
      } catch (e) {
        console.error('[人机] ' + kind + ' 失败：' + (e && e.message));
      }
      if (i < n - 1) await botPace();
    }
  }
}

/* 管理台「立即执行一轮」：不等定时器，立刻做一条指定动作 */
function botRunOnce(kind) {
  return botAction(kind, { manual: true });
}

const BOT_JOB_META = [
  { key: 'post', label: '发帖', every: 'botPostEverySec', round: 'botPostPerRound' },
  { key: 'comment', label: '评论', every: 'botCommentEverySec', round: 'botCommentPerRound' },
  { key: 'reply', label: '回复', every: 'botReplyEverySec', round: 'botReplyPerRound' },
  { key: 'like', label: '点赞', every: 'botLikeEverySec', round: 'botLikePerRound' },
  { key: 'repost', label: '转帖', every: 'botRepostEverySec', round: 'botRepostPerRound' },
  { key: 'follow', label: '关注', every: 'botFollowEverySec', round: 'botFollowPerRound' },
  { key: 'dm', label: '私信', every: 'botDmEverySec', round: 'botDmPerRound' }
];

/* 设置变化后重建定时器：每类动作一个，间隔 ±35% 抖动，全为 0 时不建 */
function restartBotEngine() {
  botTimers.forEach((t) => {
    try { clearTimeout(t); } catch (e) { /* 已停止 */ }
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
  const jobs = BOT_JOB_META.map((m) => ({
    key: m.key,
    label: m.label,
    every: Math.min(3600, Math.max(1, Math.round(Number(cfg[m.every]) || 20))),
    round: botRoundCount(cfg[m.round])
  })).filter((j) => j.round > 0);
  if (!jobs.length) {
    console.log('[人机] 七类动作都是 0 条，引擎待机');
    return;
  }
  const started = [];
  jobs.forEach((j) => {
    const payload = {};
    payload[j.key] = j.round;
    const arm = () => {
      const wait = Math.max(2000, Math.round(j.every * 1000 * (0.65 + Math.random() * 0.7)));
      const timer = setTimeout(async () => {
        try {
          await botRound(payload);
        } catch (e) {
          console.error('[人机] ' + j.label + ' 异常：' + (e && e.message));
        }
        arm();
      }, wait);
      if (timer.unref) timer.unref();
      botTimers.push(timer);
    };
    arm();
    started.push(j.label + ' 约 ' + j.every + ' 秒 ' + j.round + ' 条');
  });
  const aiOn = !!cfg.aiEnabled && !!cfg.aiApiKey && !!cfg.aiBaseUrl;
  console.log(
    '[人机] 引擎已启动（' + started.join('；') + '；内容来源：' +
      (aiOn ? 'AI ' + (cfg.aiModel || '默认模型') : '本地语料') + '）'
  );
}

const server = http.createServer((req, res) => {
  /* json() 里按客户端的 Accept-Encoding 决定要不要 gzip */
  res._acceptEnc = String(req.headers['accept-encoding'] || '');
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

/* 公网隧道下连接会被反复复用：Node 默认 keepAliveTimeout 只有 5 秒，
   空闲一下就被关掉，隧道里表现为「一会儿能连一会儿断」。放宽到 nginx 同级的 65 秒，
   并取消单连接请求数上限（大文件上传时会用完默认配额）。 */
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.requestTimeout = 0;
server.maxRequestsPerSocket = 0;

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
  restartAiEngine();
  resetIpRules();
  /* 启动即做一次维护（清过期登录态 / 旧日志 / 优化查询计划 / 回写 WAL），之后每 6 小时一次 */
  try {
    const h = housekeeping();
    if (h.sessions || h.logs) console.log('[维护] 清理过期登录态 ' + h.sessions + ' 条、旧日志 ' + h.logs + ' 条');
  } catch (e) {
    console.log('[维护] 失败: ' + (e && e.message));
  }
  function cleanupGalleryPreviews() {
    try {
      expireGalleryTasks(30).forEach((id) => {
        try { fs.unlinkSync(path.join(MEDIA_DIR, id)); } catch (e) {}
        try { db.prepare('DELETE FROM media WHERE id = ?').run(id); } catch (e) {}
      });
    } catch (e) {}
  }
  cleanupGalleryPreviews();
  const hkTimer = setInterval(() => {
    try {
      housekeeping();
    } catch (e) {}
    cleanupGalleryPreviews();
  }, 6 * 3600 * 1000);
  const galTimer = setInterval(() => { cleanupGalleryPreviews(); }, 10 * 60 * 1000);
  if (galTimer.unref) galTimer.unref();
  if (hkTimer.unref) hkTimer.unref();
  /* 内网穿透：管理台勾了「开机自动启动」就在这里拉起隧道 */
  try {
    killStaleTunnels();
  } catch (e) {}
  if (getSettings().tunnelAuto) {
    setTimeout(() => {
      try {
        tunnelStart({});
      } catch (e) {
        console.error('[隧道] 启动失败：' + (e && e.message ? e.message : e));
      }
    }, 1500);
  }
  /* 自动备份：启动时检查一次，之后每小时检查（间隔与保留份数在 settings 里） */
  autoBackupTick();
  setInterval(autoBackupTick, 60 * 60 * 1000);
  /* 隧道守护：20 秒看一次，掉线自动重连 */
  /* 8 秒看一次：隧道掉了能在十几秒内拉回来，公网用户几乎无感 */
  setInterval(tunnelTick, 8 * 1000);
  /* 旧版本把「开机自动」记在 settings 里，这里补一次 want，守护才有意义 */
  if (getSettings().tunnelAuto) setTimeout(() => { tunnel.want = true; }, 2000);
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