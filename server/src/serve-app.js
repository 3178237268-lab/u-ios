'use strict';
/*
 * 本地静态服务器：把 index.html 当作网站根页面跑起来
 *   用法: node serve-app.js [port]
 *   默认 http://127.0.0.1:8765/  ，同时监听局域网 IP，手机连热点也能访问
 * 为什么需要它：index.html 直接双击（file://）虽然能渲染，但浏览器把 file:// 当成
 * 不透明源，剪贴板、部分上传、localStorage 隔离等行为会不一致，用 HTTP 打开最稳。
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = __dirname;
const PORT = Number(process.argv[2] || process.env.PORT || 8765);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

/* ── 同端口反向代理 ──────────────────────────────────────────────
 * 手机经常只能访问一个地址（路由器转发 / 热点转发，比如 http://192.168.1.94:17880），
 * 那个端口只会打到本文件的静态服务，直接请求 /api、/media 会 404，App 就显示"后台未启动"。
 * 这里把后端相关路径原样转发给 8787，前端因此可以用 location.origin 当服务器地址。
 */
const API_HOST = process.env.API_HOST || '127.0.0.1';
const API_PORT = Number(process.env.API_PORT || 8787);
const PROXY_PREFIXES = ['/api', '/media', '/admin.html', '/public', '/check'];  // /lan/* 是安卓壳的原生接口，网页端本就没有，别转发
const needProxy = (p) => PROXY_PREFIXES.some((pre) => p === pre || p.startsWith(pre + '/'));

/* 反代复用 TCP 连接：页面一次要发十几二十个接口请求，
   每个都新建连接在慢网下光是握手就很明显 */
const apiAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 128,
  maxFreeSockets: 64,
  /* 空闲连接留 60 秒：公网隧道里重建一次 TCP 要几百毫秒，能复用就复用 */
  timeout: 60000
});

function proxyToApi(req, res) {
  const headers = Object.assign({}, req.headers, {
    host: API_HOST + ':' + API_PORT,
    /* 浏览器发来的可能是 close（隧道里很常见），改成 keep-alive 才能复用上游连接 */
    connection: 'keep-alive'
  });
  const up = http.request({ host: API_HOST, port: API_PORT, method: req.method, path: req.url, headers, agent: apiAgent }, (ur) => {
    res.writeHead(ur.statusCode || 502, ur.headers);
    ur.pipe(res);
  });
  /* 上游卡住不能把浏览器请求无限拖住：以前后端连接池状态坏掉时 /api/* 全部挂死，
     页面看起来就是「连不上服务器」。30 秒还没头就主动断开并回 504，前端会自动重试。
     但上传接口例外：300MB 的视频在公网要传好几分钟，30 秒掐断就等于永远传不上去。 */
  const isUpload = req.method === 'POST' && /^\/api\/media(\/|$|\?)/.test(req.url || '');
  if (!isUpload) {
    up.setTimeout(30000, () => {
      try { up.destroy(new Error('upstream timeout')); } catch (e) { /* 已关闭 */ }
    });
  }
  up.on('error', (err) => {
    const timeout = /timeout/i.test(String(err && err.message));
    if (!res.headersSent) {
      res.writeHead(timeout ? 504 : 502, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      res.end(JSON.stringify({ error: timeout ? '服务器响应超时（' + API_PORT + '），请稍后自动重试' : '后端未启动（' + API_PORT + '），先启动服务器' }));
    } else {
      try { res.destroy(); } catch (e) { /* 已断开 */ }
    }
  });
  req.on('aborted', () => {
    try { up.destroy(); } catch (e) { /* 已关闭 */ }
  });
  req.pipe(up);
}

/* ── gzip ────────────────────────────────────────────────────────
 * 首页 index.html 有 2.4MB，免费内网穿透的带宽只有几十 KB/s，不压缩要传十几秒，
 * 浏览器就显示"打不开"。文本类资源一律 gzip（约 1/6 体积），结果按 mtime+size 缓存。
 */
const GZIP_EXT = new Set(['.html', '.js', '.css', '.json', '.txt', '.svg']);
const gzipCache = new Map();   // key: file:mtime:size:enc → Buffer
let gzipCacheBytes = 0;

function compressFile(file, st, enc, cb) {
  const key = file + ':' + st.mtimeMs + ':' + st.size + ':' + enc;
  const hit = gzipCache.get(key);
  if (hit) return cb(null, hit);
  fs.readFile(file, (err, buf) => {
    if (err) return cb(err);
    const done = (e2, out) => {
      if (e2) return cb(e2);
      if (out.length < 4 * 1024 * 1024 && gzipCacheBytes < 32 * 1024 * 1024) {
        gzipCache.set(key, out);
        gzipCacheBytes += out.length;
      }
      cb(null, out);
    };
    // br 比 gzip 再小 30~40%，对慢速内网穿透很关键；老客户端走 gzip 兜底
    if (enc === 'br') return zlib.brotliCompress(buf, {
      params: {
        /* 页面与脚本用最高压缩档次（只压一次就进缓存）：index.html 188KB → 约 154KB，
           公网隧道上这点差距就是一两秒 */
        [zlib.constants.BROTLI_PARAM_QUALITY]: (file.endsWith('.html') || file.endsWith('.js')) ? 11 : 5,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length
      }
    }, done);
    zlib.gzip(buf, { level: 6 }, done);
  });
}

const handler = (req, res) => {
  if (process.env.U_LOG !== '0') {
    const ip = String(req.socket.remoteAddress || '').replace('::ffff:', '');
    console.log(new Date().toISOString().slice(11, 19), ip, req.method, String(req.url).slice(0, 120));
  }
  let p;
  try {
    p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    res.writeHead(400); return res.end('bad request');
  }
  if (p === '/' || p === '') p = '/index.html';
  if (p === '/favicon.ico') { res.writeHead(204); return res.end(); }   // 浏览器自动请求，别报 404
  if (needProxy(p)) return proxyToApi(req, res);
  const file = path.join(ROOT, p);
  // 防目录穿越：解析后必须仍在项目根内
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404 not found'); }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    // vendor/ 下是 three.js、3D 模型等大文件，放开缓存；
    // 页面本体用 no-cache + ETag：改完立刻生效，没改动时刷新只回 304（几十字节），不用重下 190KB
    // app.js 文件名带版本参数（app.js?v=…），内容变了版本号就变，可以长期缓存；
    // 这样公网弱网下第二次打开只回 304，不用重下 90KB。
    const immut = p.startsWith('/vendor/');
    const cache = immut ? 'public, max-age=31536000, immutable' : 'no-cache';
    const etag = '"' + st.size.toString(16) + '-' + Math.round(st.mtimeMs).toString(16) + '"';
    if (req.headers['if-none-match'] === etag && !req.headers.range) {
      res.writeHead(304, { 'Cache-Control': cache, 'ETag': etag });
      return res.end();
    }
    const head = { 'Content-Type': type, 'Cache-Control': cache, 'ETag': etag, 'Accept-Ranges': 'bytes' };
    const range = req.headers.range;
    if (range && /^bytes=\d*-\d*$/.test(range)) {
      const [s, e] = range.replace('bytes=', '').split('-');
      const start = s ? Number(s) : 0;
      const end = e ? Math.min(Number(e), st.size - 1) : st.size - 1;
      if (start >= st.size) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, { ...head, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    const ext = path.extname(file).toLowerCase();
    const ae = String(req.headers['accept-encoding'] || '');
    const enc = !GZIP_EXT.has(ext) || range ? '' : (/\bbr\b/.test(ae) ? 'br' : (/\bgzip\b/.test(ae) ? 'gzip' : ''));
    if (enc) {
      return compressFile(file, st, enc, (e2, out) => {
        if (e2) { res.writeHead(500); return res.end('compress failed'); }
        res.writeHead(200, {
          'Content-Type': type,
          'Cache-Control': p.startsWith('/vendor/') ? 'public, max-age=31536000, immutable' : 'no-cache',
          'ETag': etag,
          'Content-Encoding': enc,
          'Vary': 'Accept-Encoding',
          'Content-Length': out.length
        });
        if (req.method === 'HEAD') return res.end();
        res.end(out);
      });
    }
    res.writeHead(200, { ...head, 'Content-Length': st.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
};

const server = http.createServer(handler);

/* 与后端一致：默认 5 秒 keepAliveTimeout 在隧道下太短，空闲就断，用户感觉「经常掉线」 */
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.requestTimeout = 0;

/* 启动后预热压缩缓存：q11 压 800KB 页面要一两秒，先压好，
   第一个访客就不用等（失败无所谓，按需压就行） */
function warmCompress() {
  const files = ['index.html', 'vendor/three.min.js', 'admin.html'].map((f) => path.join(ROOT, f));
  files.forEach((file) => {
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) return;
      ['br', 'gzip'].forEach((enc) => compressFile(file, st, enc, () => {}));
    });
  });
}
setTimeout(warmCompress, 300);

server.listen(PORT, '0.0.0.0', () => {
  const nets = require('node:os').networkInterfaces();
  const ips = Object.values(nets).flat().filter(n => n && n.family === 'IPv4' && !n.internal).map(n => n.address);
  console.log(`U app  ->  http://127.0.0.1:${PORT}/`);
  for (const ip of ips) console.log(`           http://${ip}:${PORT}/`);
  console.log(`           /api 与 /media 已反代到 ${API_HOST}:${API_PORT}（同端口即可用）`);
  /* 有些手机 / 路由器转发只放行固定端口（例如 17880），这里额外开一个同样的口，
     同一个页面在哪个端口打开都能跑，不用改转发规则。 */
  const extra = String(process.env.U_EXTRA_PORTS || '17880').split(',').map((s) => Number(s.trim())).filter((p) => p && p !== PORT);
  for (const port of extra) {
    const s = http.createServer(handler);
    s.on('error', (e) => console.log(`额外端口 ${port} 没起来：${e.code}`));
    s.listen(port, '0.0.0.0', () => {
      console.log(`           http://127.0.0.1:${port}/  （额外端口）`);
      for (const ip of ips) console.log(`           http://${ip}:${port}/`);
    });
  }
});
