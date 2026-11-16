
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'drop2-data');
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const PORT = 18925, SITE = 18792;
const S = 'http://127.0.0.1:' + PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18791', U_DATA_DIR: DATA }, stdio: 'ignore' });
const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const f = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(b); });
}).listen(SITE);
(async () => {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.goto('http://127.0.0.1:' + SITE + '/', { waitUntil: 'load', timeout: 40000 });
  await page.evaluate((s) => { localStorage.setItem('u-server', s); }, S);
  await page.reload({ waitUntil: 'load' }); await sleep(600);
  const g = await page.$('#guestBtn'); if (g) { await g.click(); await sleep(1200); }
  await page.click('.tab[data-tab="search"]'); await sleep(400);
  await page.fill('#searchInput', '好');
  await sleep(500);
  const stateA = await page.evaluate(() => ({ cls: document.querySelector('#viewSearch').className, dropH: document.querySelector('#searchDrop').getBoundingClientRect().height }));
  await page.press('#searchInput', 'Enter'); await sleep(700);
  const stateB = await page.evaluate(() => {
    const d = document.querySelector('#searchDrop');
    const cs = getComputedStyle(d);
    return { cls: document.querySelector('#viewSearch').className, display: cs.display, h: Math.round(d.getBoundingClientRect().height), res: document.querySelector('#searchResults').getBoundingClientRect().height, sug: (document.querySelector('#searchSug') || {}).innerHTML ? 'has' : 'empty' };
  });
  await page.screenshot({ path: path.join(ROOT, '.tmp-test', 'drop-results-1.png') });
  // 在二级页点击搜索框并输入
  await page.click('#searchInput'); await sleep(300);
  await page.fill('#searchInput', '好'); await sleep(500);
  const stateC = await page.evaluate(() => {
    const d = document.querySelector('#searchDrop');
    const cs = getComputedStyle(d);
    return { cls: document.querySelector('#viewSearch').className, display: cs.display, h: Math.round(d.getBoundingClientRect().height), opacity: cs.opacity, sug: (document.querySelector('#searchSug') || {}).children.length };
  });
  await page.screenshot({ path: path.join(ROOT, '.tmp-test', 'drop-results-2.png') });
  console.log(JSON.stringify({ stateA, stateB, stateC, errs }));
  await browser.close(); site.close(); srv.kill();
})().catch((e) => { console.log('ERR ' + e); process.exit(2); });
