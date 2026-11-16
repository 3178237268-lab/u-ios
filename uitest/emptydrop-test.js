
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'drop-empty-data');
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const PORT = 18935, SITE = 18773;
const S = 'http://127.0.0.1:' + PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18772', U_DATA_DIR: DATA }, stdio: 'ignore' });
const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const f = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(b); });
}).listen(SITE);
const out = []; const T = (name, ok, extra) => out.push({ name, ok: !!ok, extra: extra === undefined ? '' : extra });
(async () => {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }
  const reg = await (await fetch(S + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'lizi', password: 'lizi123', nickname: '栗子汽水' }) })).json();
  for (const t of ['今天的晚霞好看得不像话。', '耳机随机播到一首很久没听的歌。']) {
    await fetch(S + '/api/posts', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + reg.token }, body: JSON.stringify({ text: t, media: [] }) });
  }
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.goto('http://127.0.0.1:' + SITE + '/', { waitUntil: 'load', timeout: 40000 });
  await page.evaluate((s) => { localStorage.setItem('u-server', s); localStorage.removeItem('u-search-hist'); }, S);
  await page.reload({ waitUntil: 'load' }); await sleep(700);
  const g = await page.$('#guestBtn'); if (g) { await g.click(); await sleep(2500); }
  const h = () => page.evaluate(() => { const d = document.querySelector('#searchDrop'); return d ? Math.round(d.getBoundingClientRect().height) : -1; });
  const cls = () => page.evaluate(() => document.querySelector('#viewSearch').className);
  await page.click('.tab[data-tab="search"]'); await sleep(500);
  T('初始输入框为空', (await page.inputValue('#searchInput')) === '');
  T('初始下拉框高度 0', (await h()) <= 4, await h());
  await page.click('.search-box'); await sleep(500);
  T('空输入点搜索框不展开', (await h()) <= 4, await h());
  T('无 search-hist-open 类', !(await cls()).includes('search-hist-open'));
  await page.fill('#searchInput', '晚霞'); await sleep(900);
  T('输入后有建议', (await page.evaluate(() => document.querySelectorAll('#searchSug .sug-row').length)) > 0);
  T('输入后展开', (await h()) > 40, await h());
  await page.fill('#searchInput', ''); await sleep(600);
  T('清空后收起', (await h()) <= 4, await h());
  T('清空后建议清空', (await page.evaluate(() => document.querySelectorAll('#searchSug .sug-row').length)) === 0);
  // 有历史时点空输入框仍显示历史
  await page.evaluate(() => localStorage.setItem('u-search-hist', JSON.stringify(['晚霞'])));
  await page.reload({ waitUntil: 'load' }); await sleep(2500);
  await page.click('.tab[data-tab="search"]'); await sleep(400);
  await page.click('.search-box'); await sleep(500);
  const hi = await h();
  T('有历史时点搜索框展开', hi > 40, hi);
  T('展开后能看到历史词', (await page.evaluate(() => document.querySelectorAll('#searchHist .hist-chip').length)) > 0);
  const pr = await page.evaluate(() => { const el = document.querySelector('.search-box'); el.scrollIntoView(); return 1; });
  await page.screenshot({ path: path.join(ROOT, '.tmp-test', 'empty-drop.png') });
  console.log(JSON.stringify({ pass: out.filter(o => o.ok).length, total: out.length, fails: out.filter(o => !o.ok), errs }));
  await browser.close(); site.close(); srv.kill();
})().catch((e) => { console.log('ERR ' + e); process.exit(2); });
