
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'drop3-data');
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const PORT = 18926, SITE = 18790;
const S = 'http://127.0.0.1:' + PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18789', U_DATA_DIR: DATA }, stdio: 'ignore' });
const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const f = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(b); });
}).listen(SITE);
(async () => {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 } })).newPage();
  await page.goto('http://127.0.0.1:' + SITE + '/', { waitUntil: 'load', timeout: 40000 });
  await page.evaluate((s) => { localStorage.setItem('u-server', s); }, S);
  await page.reload({ waitUntil: 'load' }); await sleep(600);
  const g = await page.$('#guestBtn'); if (g) { await g.click(); await sleep(1200); }
  await page.click('.tab[data-tab="search"]'); await sleep(400);
  const drop = () => page.evaluate(() => {
    const d = document.querySelector('#searchDrop');
    const cs = getComputedStyle(d);
    return document.querySelector('#viewSearch').className + ' | display=' + cs.display + ' h=' + Math.round(d.getBoundingClientRect().height) + ' op=' + cs.opacity;
  });
  const log = {};
  await page.fill('#searchInput', '好'); await sleep(400);
  log.typedHome = await drop();
  await page.press('#searchInput', 'Enter'); await sleep(600);
  log.results = await drop();
  await page.click('.search-box'); await sleep(300);
  log.tapBox = await drop();
  await page.click('#searchInput'); await sleep(300);
  log.tapInput = await drop();
  await page.type('#searchInput', '天'); await sleep(500);
  log.typeMore = await drop();
  await page.fill('#searchInput', ''); await sleep(400);
  log.cleared = await drop();
  await page.click('#searchBack'); await sleep(500);
  log.backHome = await drop();
  await page.click('#searchInput'); await sleep(300);
  log.homeTapAfterBack = await drop();
  console.log(JSON.stringify(log, null, 1));
  await browser.close(); site.close(); srv.kill();
})().catch((e) => { console.log('ERR ' + e); process.exit(2); });
