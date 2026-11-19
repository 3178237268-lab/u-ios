'use strict';
/* 出网代理探测：这台电脑开着梯子时，系统代理一般是 127.0.0.1:7890 / 7892 之类。
   服务端自己去拉推特视频要经过它，否则 TCP 会一直挂着（进度条卡 0% 的真正原因）。 */
const http = require('http');
const https = require('https');
const tls = require('tls');
const net = require('net');
const { URL } = require('url');

const CANDIDATES = [
  '127.0.0.1:7892', '127.0.0.1:7890', '127.0.0.1:7897', '127.0.0.1:7891',
  '127.0.0.1:10809', '127.0.0.1:10808', '127.0.0.1:1080', '127.0.0.1:1087', '127.0.0.1:8889'
];
const TEST_HOST = 'video.twimg.com';
const TTL = 5 * 60 * 1000;

let cache = { url: '', at: 0, ok: false };
const agents = new Map();

function fromEnv() {
  const v = process.env.U_TW_PROXY || process.env.HTTPS_PROXY || process.env.https_proxy || process.env.ALL_PROXY || process.env.all_proxy || '';
  if (!v) return '';
  const s = String(v).trim().replace(/^socks5h?:\/\//i, 'http://');
  if (!/^https?:\/\//i.test(s)) return 'http://' + s;
  return s;
}

/* 走 CONNECT 隧道：先和梯子建 TCP，发 CONNECT，读回 200 之后在这条连接上做 TLS */
function makeAgent(proxyUrl) {
  if (agents.has(proxyUrl)) return agents.get(proxyUrl);
  const p = new URL(proxyUrl);
  const pPort = Number(p.port) || 80;
  const agent = new https.Agent({ keepAlive: false });
  /* 注意：必须挂在实例上，通过构造参数传是无效的（https.Agent 用原型方法） */
  agent.createConnection = function (opts, cb) {
      const target = opts.host + ':' + (opts.port || 443);
      let done = false;
      const fin = function (err, sock) { if (done) return; done = true; cb(err, sock); };
      const raw = net.connect({ host: p.hostname, port: pPort });
      raw.setTimeout(12000, function () { raw.destroy(); fin(new Error('proxy timeout')); });
      raw.once('connect', function () {
        raw.write('CONNECT ' + target + ' HTTP/1.1\r\nHost: ' + target + '\r\nProxy-Connection: keep-alive\r\n\r\n');
      });
      let buf = '';
      const onData = function (chunk) {
        buf += chunk.toString('latin1');
        const idx = buf.indexOf('\r\n\r\n');
        if (idx < 0) { if (buf.length > 4096) { raw.destroy(); fin(new Error('proxy bad reply')); } return; }
        raw.removeListener('data', onData);
        const line = buf.slice(0, buf.indexOf('\r\n'));
        if (!/ 200/.test(line)) { raw.destroy(); fin(new Error('proxy CONNECT ' + line.slice(9, 12))); return; }
        const t = tls.connect({ socket: raw, servername: opts.host, ALPNProtocols: ['http/1.1'] }, function () { fin(null, t); });
        t.on('error', function (e) { fin(e); });
      };
      raw.on('data', onData);
      raw.on('error', function (e) { fin(e); });
  };
  agents.set(proxyUrl, agent);
  return agent;
}

/* 用一个 CONNECT 探一下这个代理能不能把 video.twimg.com 打通 */
function probeOne(addr) {
  return new Promise(function (resolve) {
    const url = 'http://' + addr;
    let done = false;
    const fin = function (v) { if (!done) { done = true; resolve(v); } };
    try {
      const p = new URL(url);
      const target = TEST_HOST + ':443';
      const req = http.request({ host: p.hostname, port: Number(p.port) || 80, method: 'CONNECT', path: target, headers: { Host: target } });
      req.setTimeout(3000, function () { req.destroy(); fin(false); });
      req.on('connect', function (res, socket) {
        try { socket.destroy(); } catch (e) { /* ignore */ }
        fin(res.statusCode === 200);
      });
      req.on('error', function () { fin(false); });
      req.end();
    } catch (e) { fin(false); }
  });
}

async function detect(force) {
  if (!force && cache.url && Date.now() - cache.at < TTL) return cache.ok ? cache.url : '';
  const env = fromEnv();
  if (env && await probeOne(env.replace(/^https?:\/\//i, ''))) {
    cache = { url: env, at: Date.now(), ok: true };
    return env;
  }
  for (const addr of CANDIDATES) {
    if (await probeOne(addr)) {
      cache = { url: 'http://' + addr, at: Date.now(), ok: true };
      console.log('[出网代理] 走 ' + addr + ' 拉推特视频');
      return cache.url;
    }
  }
  cache = { url: '', at: Date.now(), ok: false };
  return '';
}

/* 拿一个能出网的 agent；没有代理就返回 null（直连） */
async function agent() {
  const u = await detect(false);
  return u ? makeAgent(u) : null;
}

async function info() {
  const u = await detect(false);
  return { proxy: u, candidates: CANDIDATES };
}

module.exports = { detect: detect, agent: agent, info: info, CANDIDATES: CANDIDATES };
