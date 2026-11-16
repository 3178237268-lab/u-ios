
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'perf3-data');
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const PORT = 18943, SITE = 18773, THROTTLE = Number(process.env.THROTTLE || 6);
const S = 'http://127.0.0.1:' + PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18773', U_DATA_DIR: DATA }, stdio: 'ignore' });
const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const f = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(b); });
}).listen(SITE);
let browser;
(async () => {
  for (let i = 0; i < 90; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }
  const g = await (await fetch(S + '/api/guest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).json();
  const auth = { 'content-type': 'application/json', authorization: 'Bearer ' + g.token };
  for (let i = 0; i < 300; i++) {
    await fetch(S + '/api/posts', { method: 'POST', headers: auth, body: JSON.stringify({ text: '晚霞很好看 第' + i + ' 条 好天气 好好生活 hello world ' + '内容'.repeat(6) }) });
  }
  browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
  await page.goto('http://127.0.0.1:' + SITE + '/', { waitUntil: 'load', timeout: 60000 });
  await page.evaluate((s) => { localStorage.setItem('u-server', s); }, S);
  await page.reload({ waitUntil: 'load' }); await sleep(600);
  await page.evaluate(() => { const b = document.querySelector('#guestBtn'); if (b) b.click(); });
  await sleep(4000);
  await page.evaluate(() => { const t = document.querySelector('.tab[data-tab="search"]'); if (t) t.click(); });
  await sleep(1200);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  await page.evaluate(() => {
    window.__stats = []; window.__muts = 0; window.__lt = []; let pending = null;
    new PerformanceObserver((l) => { l.getEntries().forEach((e) => window.__lt.push(Math.round(e.duration))); }).observe({ entryTypes: ['longtask'] });
    const box = document.querySelector('#searchSug');
    new MutationObserver(() => { window.__muts++; if (pending != null) { window.__stats.push(Math.round(performance.now() - pending)); pending = null; } }).observe(box, { childList: true, subtree: true, characterData: true });
    document.querySelector('#searchInput').addEventListener('input', () => { pending = performance.now(); });
    document.querySelector('#searchInput').focus();
  });
  const lat = [];
  for (const ch of ['好', '天', '气', 'h', 'e', 'l', '好']) {
    const t0 = Date.now();
    await page.keyboard.type(ch, { delay: 0 });
    await sleep(650);
    lat.push(Date.now() - t0);
  }
  const r = await page.evaluate(() => ({ stats: window.__stats, muts: window.__muts, lt: window.__lt, rows: document.querySelectorAll('#searchSug .sug-row').length }));
  console.log(JSON.stringify({ throttle: THROTTLE, firstPaintLatency: r.stats, domWrites: r.muts, longtasks: r.lt, rows: r.rows, errs }));
})().catch((e) => console.log(JSON.stringify({ fatal: String(e).slice(0, 200) }))).finally(async () => { try { await browser.close(); } catch (e) {} site.close(); srv.kill(); });
