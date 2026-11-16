
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'lk42-data'); fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const PORT = 18935, SITE = 18835, S = 'http://127.0.0.1:' + PORT, PAGE = 'http://127.0.0.1:' + SITE + '/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18735', U_DATA_DIR: DATA }, stdio: 'ignore' });
const site = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split('?')[0]); const f = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p); fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(b); }); }).listen(SITE);
(async () => {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 } })).newPage();
  await page.goto(PAGE, { waitUntil: 'load' });
  await page.evaluate((s) => { localStorage.setItem('u-server', s); localStorage.setItem('u-theme', 'light'); }, S);
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(1500);
  await page.click('#guestBtn').catch(() => {}); await page.waitForTimeout(1800);
  const made = await page.evaluate(async (s) => { const tk = localStorage.getItem('u-server-token'); const r = await fetch(s + '/api/posts', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tk }, body: JSON.stringify({ text: '赞测试 41' }) }); return { st: r.status, body: (await r.text()).slice(0, 200) }; }, S);
  const apiPosts = await page.evaluate(async (s) => { const r = await fetch(s + '/api/posts?limit=10'); const j = await r.json(); return (j.posts || []).map((p) => ({ id: p.id, author: p.author && (p.author.handle || p.author.name), text: (p.text || '').slice(0, 20), private: p.private })); }, S);
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(2500);
  const info = await page.evaluate(() => ({ posts: document.querySelectorAll('#feedList .post').length, likeBtns: document.querySelectorAll('.pactions .like').length, feedList: !!document.querySelector('#feedList'), activeHome: (document.querySelector('#homeTabs .feedtab.on') || {}).textContent, bodyHasLight: document.body.classList.contains('light'), feedTxt: (document.querySelector('#feedList') || {}).textContent ? document.querySelector('#feedList').textContent.trim().slice(0, 80) : '' }));
  await page.evaluate(() => { const b = document.querySelector('#homeTabs .feedtab[data-home="talk"]'); if (b) b.click(); });
  await page.waitForTimeout(1500);
  const info2 = await page.evaluate(() => ({ posts: document.querySelectorAll('#feedList .post').length, likeBtns: document.querySelectorAll('.pactions .like').length, on: (document.querySelector('#homeTabs .feedtab.on') || {}).textContent, txt: (document.querySelector('#feedList') || {}).textContent.trim().slice(0, 80) }));
  console.log('MADE ' + JSON.stringify(made));
  console.log('API ' + JSON.stringify(apiPosts));
  console.log('INFO ' + JSON.stringify(info));
  console.log('INFO2 ' + JSON.stringify(info2));
  await browser.close(); srv.kill(); site.close(); try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) {}

  process.exit(0);
})().catch((e) => { console.log('ERR ' + e.stack); process.exit(1); });