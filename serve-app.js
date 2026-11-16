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

function proxyToApi(req, res) {
  const headers = Object.assign({}, req.headers, { host: API_HOST + ':' + API_PORT });
  const up = http.request({ host: API_HOST, port: API_PORT, method: req.method, path: req.url, headers }, (ur) => {
    res.writeHead(ur.statusCode || 502, ur.headers);
    ur.pipe(res);
  });
  up.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: '后端未启动（' + API_PORT + '），先启动服务器' }));
  });
  req.pipe(up);
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
  if (needProxy(p)) return proxyToApi(req, res);
  const file = path.join(ROOT, p);
  // 防目录穿越：解析后必须仍在项目根内
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404 not found'); }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const head = { 'Content-Type': type, 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
    const range = req.headers.range;
    if (range && /^bytes=\d*-\d*$/.test(range)) {
      const [s, e] = range.replace('bytes=', '').split('-');
      const start = s ? Number(s) : 0;
      const end = e ? Math.min(Number(e), st.size - 1) : st.size - 1;
      if (start >= st.size) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, { ...head, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...head, 'Content-Length': st.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
};

const server = http.createServer(handler);

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
