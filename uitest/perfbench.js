
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'perf2-data');
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const PORT = 18942, SITE = 18772, THROTTLE = Number(process.env.THROTTLE || 6);
const S = 'http://127.0.0.1:' + PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18772', U_DATA_DIR: DATA }, stdio: 'ignore' });
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
    window.__lt = []; window.__paint = [];
    new PerformanceObserver((l) => { l.getEntries().forEach((e) => window.__lt.push(Math.round(e.duration))); }).observe({ entryTypes: ['longtask'] });
    const box = document.querySelector('#searchSug');
    window.__muts = [];
    new MutationObserver(() => { window.__muts.push(Math.round(performance.now())); }).observe(box, { childList: true });
    window.__inp = [];
    document.querySelector('#searchInput').addEventListener('input', () => window.__inp.push(Math.round(performance.now())));
    document.querySelector('#searchInput').focus();
  });
  for (const ch of ['好', '天', '气', 'h', 'e', 'l']) {
    await page.keyboard.type(ch, { delay: 0 });
    await sleep(700);
  }
  const r = await page.evaluate(() => ({ lt: window.__lt, inp: window.__inp, muts: window.__muts }));
  const lat = r.inp.map((t, i) => (r.muts[i] != null ? r.muts[i] - t : null)).filter((x) => x != null);
  console.log(JSON.stringify({ throttle: THROTTLE, longtasks: r.lt, maxLatencyMs: Math.max(0, ...lat), latencies: lat, errs }));
})().catch((e) => console.log(JSON.stringify({ fatal: String(e).slice(0, 200) }))).finally(async () => { try { await browser.close(); } catch (e) {} site.close(); srv.kill(); });
