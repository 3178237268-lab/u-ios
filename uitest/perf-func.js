
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'perf5-data');
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const PORT = 18945, SITE = 18776, S = 'http://127.0.0.1:' + PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18775', U_DATA_DIR: DATA }, stdio: 'ignore' });
const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const f = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(b); });
}).listen(SITE);
let browser; const checks = [];
const ok = (n, c, d) => checks.push({ n, ok: !!c, d });
(async () => {
  for (let i = 0; i < 90; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }
  browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.goto('http://127.0.0.1:' + SITE + '/', { waitUntil: 'load', timeout: 60000 });
  await page.evaluate((s) => { localStorage.setItem('u-server', s); }, S);
  await page.reload({ waitUntil: 'load' }); await sleep(500);
  await page.evaluate(() => { const b = document.querySelector('#guestBtn'); if (b) b.click(); });
  await sleep(3500);
  await page.evaluate(async () => {
    const t = localStorage.getItem('u-server-token');
    for (const txt of ['晚霞很好看 好天气', '好好生活 hello', '别的帖子']) {
      await fetch(localStorage.getItem('u-server') + '/api/posts', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: JSON.stringify({ text: txt }) });
    }
  });
  await page.evaluate(() => { const t = document.querySelector('.tab[data-tab="search"]'); if (t) t.click(); });
  await sleep(1500);
  const closed = await page.evaluate(() => { const d = document.querySelector('#searchDrop'); return { h: Math.round(d.getBoundingClientRect().height), pe: getComputedStyle(d).pointerEvents }; });
  ok('下拉框初始收起', closed.h <= 4 && closed.pe === 'none', JSON.stringify(closed));
  await page.evaluate(() => { document.querySelector('#searchInput').focus(); });
  await page.keyboard.type('好', { delay: 0 });
  await sleep(1600);
  const s1 = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#searchSug .sug-row')].map((r) => r.textContent.trim());
    const d = document.querySelector('#searchDrop');
    return { rows, h: Math.round(d.getBoundingClientRect().height), pe: getComputedStyle(d).pointerEvents, trans: getComputedStyle(d).transitionProperty, dataH: document.querySelector('#searchSug').getAttribute('data-h') ? 'set' : 'none' };
  });
  ok('输入后下拉展开', s1.h > 40 && s1.pe === 'auto', JSON.stringify({ h: s1.h, pe: s1.pe }));
  ok('有「搜索 好」行', s1.rows.some((t) => t.indexOf('搜索 好') >= 0), JSON.stringify(s1.rows));
  ok('有帖子建议行', s1.rows.length >= 2, String(s1.rows.length));
  ok('过渡只动 opacity/transform', s1.trans === 'opacity, transform', s1.trans);
  ok('data-h 已写入', s1.dataH === 'set', s1.dataH);
  await page.evaluate(() => { const r = document.querySelector('#searchSug .sug-row[data-sgp]') || document.querySelector('#searchSug .sug-row[data-sgo]'); r.click(); });
  await sleep(1200);
  const s2 = await page.evaluate(() => ({ mode: document.querySelector('#viewSearch').className, resRows: document.querySelectorAll('#searchResults .hot-item, #searchResults .search-user').length, dropH: Math.round(document.querySelector('#searchDrop').getBoundingClientRect().height) }));
  ok('点建议进二级页并收起下拉', s2.mode.indexOf('search-results-mode') >= 0 && s2.dropH <= 6, JSON.stringify(s2));
  await page.keyboard.press('Enter');
  await sleep(400);
  ok('pageerror 0', errs.length === 0, errs.join('|'));
  console.log(JSON.stringify({ pass: checks.filter((c) => c.ok).length, total: checks.length, fail: checks.filter((c) => !c.ok) }));
  await page.screenshot({ path: path.join(ROOT, '.tmp-test', 'search-functional.png') });
})().catch((e) => console.log(JSON.stringify({ fatal: String(e).slice(0, 200) }))).finally(async () => { try { await browser.close(); } catch (e) {} site.close(); srv.kill(); });
