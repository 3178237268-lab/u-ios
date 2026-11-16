
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'swipe-data');
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const PORT = 18938, SITE = 18767;
const S = 'http://127.0.0.1:' + PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18766', U_DATA_DIR: DATA }, stdio: 'ignore' });
const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const f = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(b); });
}).listen(SITE);
let browser;
(async () => {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }
  browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.goto('http://127.0.0.1:' + SITE + '/', { waitUntil: 'load', timeout: 40000 });
  await page.evaluate((s) => {
    localStorage.setItem('u-server', s); localStorage.removeItem('u-dm-hidden');
    const now = Date.now();
    localStorage.setItem('u-msgs', JSON.stringify([{ id: 'dm_a', type: 'dm', text: '111', createdAt: now - 30000, read: false, user: { name: '111', handle: '111', key: 'u_111' } }]));
  }, S);
  await page.reload({ waitUntil: 'load' }); await sleep(700);
  await page.evaluate(() => { const b = document.querySelector('#guestBtn'); if (b) b.click(); });
  await sleep(2800);
  await page.evaluate(() => { const t = document.querySelector('.tab[data-tab="dm"]'); if (t) t.click(); });
  await sleep(1200);
  const closed = await page.evaluate(() => {
    const sw = document.querySelector('.swipe'); if (!sw) return null;
    const del = sw.querySelector('.swipe-del');
    const cs = getComputedStyle(sw), cd = getComputedStyle(del);
    return { swipeBg: cs.backgroundColor, swipeImg: cs.backgroundImage, delBg: cd.backgroundImage.slice(0, 60), rowW: Math.round(sw.querySelector('.msg-row').getBoundingClientRect().width) };
  });
  await page.screenshot({ path: path.join(ROOT, '.tmp-test', 'swipe-closed.png') });
  await page.evaluate(() => { const sw = document.querySelector('.swipe'); if (sw) sw.classList.add('open'); });
  await sleep(500);
  await page.screenshot({ path: path.join(ROOT, '.tmp-test', 'swipe-open.png') });
  console.log(JSON.stringify({ closed, errs }));
})().catch((e) => console.log(JSON.stringify({ fatal: String(e).slice(0, 160) }))).finally(async () => { try { await browser.close(); } catch (e) {} site.close(); srv.kill(); });
