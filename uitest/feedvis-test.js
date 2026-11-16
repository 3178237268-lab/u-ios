
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'feed-vis-data');
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const PORT = 18936, SITE = 18771;
const S = 'http://127.0.0.1:' + PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18770', U_DATA_DIR: DATA }, stdio: 'ignore' });
const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const f = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(b); });
}).listen(SITE);
const out = []; const T = (n, ok, extra) => out.push({ name: n, ok: !!ok, extra: extra === undefined ? '' : extra });
(async () => {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }
  const reg = await (await fetch(S + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'lizi', password: 'lizi123', nickname: '栗子汽水' }) })).json();
  const texts = ['甲发的第一条帖子内容ABC', '甲发的第二条帖子内容DEF', '甲发的第三条帖子内容GHI'];
  for (const t of texts) {
    const r = await (await fetch(S + '/api/posts', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + reg.token }, body: JSON.stringify({ text: t, media: [] }) })).json();
  }
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  // 游客 B（另一个账号）看推荐流
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.goto('http://127.0.0.1:' + SITE + '/', { waitUntil: 'load', timeout: 40000 });
  await page.evaluate((s) => { localStorage.setItem('u-server', s); localStorage.removeItem('u-dm-hidden'); }, S);
  await page.reload({ waitUntil: 'load' }); await sleep(600);
  const g = await page.$('#guestBtn'); if (g) { await g.click(); await sleep(2600); }
  await sleep(1500);
  const feed = await page.evaluate(() => {
    const list = document.querySelector('#feedList');
    return { count: list.querySelectorAll('.post').length, text: list.innerText.slice(0, 400), empty: !!list.querySelector('.empty') };
  });
  T('游客在为你推荐看到 3 条', feed.count === 3, feed.count);
  T('能看到甲发的文字', feed.text.includes('甲发的第一条帖子内容ABC'), feed.text.replace(/\s+/g, ' ').slice(0, 120));
  T('没有空状态', !feed.empty);
  await page.screenshot({ path: path.join(ROOT, '.tmp-test', 'feed-vis.png') });
  // 切到说说也应正常
  const segs = await page.$$('.seg button');
  if (segs[1]) { await segs[1].click(); await sleep(700); }
  const talk = await page.evaluate(() => { const l = document.querySelector('#talkList'); return { count: l ? l.querySelectorAll('.post').length : -1, has: l ? l.innerText.includes('甲发的第一条帖子内容ABC') : false }; });
  T('说说里也看得到', talk.count >= 3 && talk.has, JSON.stringify(talk));
  console.log(JSON.stringify({ pass: out.filter(o => o.ok).length, total: out.length, fails: out.filter(o => !o.ok), errs }));
  await browser.close(); site.close(); srv.kill();
})().catch((e) => { console.log('ERR ' + e); process.exit(2); });
