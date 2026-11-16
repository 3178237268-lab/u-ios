
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'perf-data');
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const PORT = 18941, SITE = 18771;
const S = 'http://127.0.0.1:' + PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18770', U_DATA_DIR: DATA }, stdio: 'ignore' });
const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const f = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(b); });
}).listen(SITE);
let browser;
(async () => {
  for (let i = 0; i < 90; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }
  // seed 60 posts via api
  const g = await (await fetch(S + '/api/guest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).json();
  for (let i = 0; i < 60; i++) {
    await fetch(S + '/api/posts', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + g.token }, body: JSON.stringify({ text: '晚霞很好看 第' + i + ' 条 好天气 好好生活 hello world ' + i }) });
  }
  browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--js-flags=--expose-gc'] });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
  await page.goto('http://127.0.0.1:' + SITE + '/', { waitUntil: 'load', timeout: 40000 });
  await page.evaluate((s) => { localStorage.setItem('u-server', s); }, S);
  await page.reload({ waitUntil: 'load' }); await sleep(600);
  await page.evaluate(() => { const b = document.querySelector('#guestBtn'); if (b) b.click(); });
  await sleep(3000);
  await page.evaluate(() => { const t = document.querySelector('.tab[data-tab="search"]'); if (t) t.click(); });
  await sleep(800);
  await page.evaluate(() => { const i = document.querySelector('#searchInput'); i.focus(); });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  // longtask observer
  await page.evaluate(() => { window.__lt = []; new PerformanceObserver((l) => { l.getEntries().forEach((e) => window.__lt.push(Math.round(e.duration))); }).observe({ entryTypes: ['longtask'] }); });
  await cdp.send('Profiler.start');
  const t0 = Date.now();
  for (const ch of ['好', '天', '气', 'h', 'e']) {
    await page.keyboard.type(ch, { delay: 0 });
    await sleep(500);
  }
  const typed = Date.now() - t0;
  const { profile } = await cdp.send('Profiler.stop');
  const lt = await page.evaluate(() => window.__lt);
  // aggregate self samples
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  const total = profile.samples.length;
  for (const id of profile.samples) {
    const n = byId.get(id); if (!n) continue;
    const cf = n.callFrame;
    const key = (cf.functionName || '(anon)') + ' @' + (cf.url ? cf.url.split('/').pop() : '') + ':' + (cf.lineNumber + 1);
    self.set(key, (self.get(key) || 0) + 1);
  }
  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, v]) => ({ k, pct: +(v * 100 / total).toFixed(1) }));
  console.log(JSON.stringify({ typed, longtasks: lt, samples: total, top, errs }));
})().catch((e) => console.log(JSON.stringify({ fatal: String(e).slice(0, 200) }))).finally(async () => { try { await browser.close(); } catch (e) {} site.close(); srv.kill(); });
