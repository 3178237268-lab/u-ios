
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'edge-data');
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const PORT = 18947, SITE = 18778, S = 'http://127.0.0.1:' + PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18777', U_DATA_DIR: DATA }, stdio: 'ignore' });
const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const f = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(b); });
}).listen(SITE);
const scan = async (page, sel) => page.evaluate((sel) => {
  return new Promise((resolve) => {
    const el = document.querySelector(sel);
    if (!el) return resolve({ err: 'no el' });
    const r = el.getBoundingClientRect();
    resolve({ x: r.x, y: r.y, w: r.width, h: r.height });
  });
}, sel);
const redCount = async (page, buf) => page.evaluate(async (b64) => {
  const img = document.getElementById('__scan');
  img.src = 'data:image/png;base64,' + b64;
  await img.decode();
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let n = 0, maxD = 0, best = null;
  for (let i = 0; i < d.length; i += 4) {
    const R = d[i], G = d[i + 1], B = d[i + 2], dm = R - Math.max(G, B);
    if (dm >= 4) { n++; if (dm > maxD) { maxD = dm; best = { r: R, g: G, b: B }; } }
  }
  return { n, maxD, best, w: c.width, h: c.height };
}, buf.toString('base64'));
let browser; const out = {};
(async () => {
  for (let i = 0; i < 90; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }
  browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  for (const theme of ['dark', 'light']) {
    const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 3 })).newPage();
    await page.setContent('<body style="margin:0"></body>');
    await page.evaluate(() => { const i = document.createElement('img'); i.id = '__scan'; document.body.appendChild(i); });
    await page.goto('http://127.0.0.1:' + SITE + '/', { waitUntil: 'load', timeout: 60000 });
    await page.evaluate((th) => {
      localStorage.setItem('u-server', location.origin.replace('18778', '18947'));
      localStorage.setItem('u-theme', th);
      const now = Date.now();
      localStorage.setItem('u-msgs', JSON.stringify([{ id: 'dm_a', type: 'dm', text: '111', createdAt: now - 20000, read: false, user: { name: '111', handle: '111', key: 'u_111' } }]));
    }, theme);
    await page.evaluate(() => { const b = document.querySelector('#guestBtn'); if (b) b.click(); });
    await sleep(2500);
    await page.evaluate(() => { const t = document.querySelector('.tab[data-tab="dm"]'); if (t) t.click(); });
    await sleep(900);
    const box = await scan(page, '.swipe');
    const clip = { x: Math.max(0, box.x + box.w - 40), y: box.y - 4, width: 44, height: box.h + 8 };
    const closed = await page.screenshot({ clip });
    const rc = await redCount(page, closed);
    fs.writeFileSync(path.join(ROOT, '.tmp-test', 'edge-closed-' + theme + '.png'), closed);
    await page.evaluate(() => { document.querySelector('.swipe').classList.add('open'); });
    await sleep(500);
    const openBuf = await page.screenshot({ clip });
    const ro = await redCount(page, openBuf);
    fs.writeFileSync(path.join(ROOT, '.tmp-test', 'edge-open-' + theme + '.png'), openBuf);
    const delOp = await page.evaluate(() => getComputedStyle(document.querySelector('.swipe-del')).opacity);
    await page.evaluate(() => { document.querySelector('.swipe').classList.remove('open'); });
    await sleep(400);
    const delOpClosed = await page.evaluate(() => getComputedStyle(document.querySelector('.swipe-del')).opacity);
    out[theme] = { closedRed: rc.n, closedMax: rc.maxD, openRed: ro.n, openMax: ro.maxD, delOpOpen: delOp, delOpClosed };
    await page.context().close();
  }
  console.log(JSON.stringify(out));
})().catch((e) => console.log(JSON.stringify({ fatal: String(e).slice(0, 200) }))).finally(async () => { try { await browser.close(); } catch (e) {} site.close(); srv.kill(); });
