
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'feedoff-data');
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const PORT = 18946, SITE = 18777, S = 'http://127.0.0.1:' + PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18776', U_DATA_DIR: DATA }, stdio: 'ignore' });
const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const f = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(b); });
}).listen(SITE);
const post = (token, text) => fetch(S + '/api/posts', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify({ text }) });
let browser; const checks = []; const ok = (n, c, d) => checks.push({ n, ok: !!c, d });
(async () => {
  for (let i = 0; i < 90; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }
  // 官方账号：服务器上注册 admin（App 里 ADMIN.username）并发 2 帖
  const reg = await (await fetch(S + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: '123456', nickname: 'U 官方' }) })).json();
  const offTok = reg.token || (await (await fetch(S + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: '123456' }) })).json()).token;
  await post(offTok, '官方帖一：欢迎来到 U');
  await post(offTok, '官方帖二：今晚八点直播');
  // 普通人 + 游客各发 1 帖
  const u = await (await fetch(S + '/api/guest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).json();
  await post(u.token, '路人帖：今天天气不错');
  const g2 = await (await fetch(S + '/api/guest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).json();
  await post(g2.token, '游客帖：随便说说');
  browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.goto('http://127.0.0.1:' + SITE + '/', { waitUntil: 'load', timeout: 60000 });
  await page.evaluate((s) => { localStorage.setItem('u-server', s); }, S);
  await page.reload({ waitUntil: 'load' }); await sleep(500);
  await page.evaluate(() => { const b = document.querySelector('#guestBtn'); if (b) b.click(); });
  await sleep(5000);
  const feed = await page.evaluate(() => ({
    n: document.querySelectorAll('#feedList .post').length,
    texts: [...document.querySelectorAll('#feedList .ptext')].map((e) => e.textContent.trim()),
    empty: !!document.querySelector('#feedList .empty')
  }));
  ok('推荐流只有 2 条官方帖', feed.n === 2, JSON.stringify(feed));
  ok('官方帖内容可见', feed.texts.join('|').indexOf('官方帖一') >= 0 && feed.texts.join('|').indexOf('官方帖二') >= 0, feed.texts.join('|'));
  ok('路人帖 / 游客帖不在推荐流', feed.texts.join('|').indexOf('路人帖') < 0 && feed.texts.join('|').indexOf('游客帖') < 0, feed.texts.join('|'));
  await page.evaluate(() => { const t = document.querySelector('.tab[data-home="talk"]') || document.querySelector('#homeTabs [data-home="talk"]'); if (t) t.click(); });
  await sleep(900);
  const talk = await page.evaluate(() => ({ n: document.querySelectorAll('#talkList .post').length, texts: [...document.querySelectorAll('#talkList .ptext')].map((e) => e.textContent.trim()) }));
  ok('说说页仍有普通人的帖', talk.texts.join('|').indexOf('路人帖') >= 0 && talk.texts.join('|').indexOf('官方帖') < 0, JSON.stringify(talk));
  ok('pageerror 0', errs.length === 0, errs.join('|'));
  await page.evaluate(() => { const t = document.querySelector('#homeTabs [data-home="feed"]'); if (t) t.click(); });
  await sleep(600);
  await page.screenshot({ path: path.join(ROOT, '.tmp-test', 'feed-official.png') });
  console.log(JSON.stringify({ pass: checks.filter((c) => c.ok).length, total: checks.length, fail: checks.filter((c) => !c.ok), feed, talk }));
})().catch((e) => console.log(JSON.stringify({ fatal: String(e).slice(0, 220) }))).finally(async () => { try { await browser.close(); } catch (e) {} site.close(); srv.kill(); });
