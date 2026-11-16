
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const OLD = path.join(ROOT, 'C:' + path.sep); // placeholder never used
const OLDFILE = 'C:\\Users\\YeKi8\\Desktop\\11111\\_backup-20261117-20261117-003625\\index.html';
const DATA = path.join(__dirname, 'edge3-data');
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const PORT = 18949, SITE = 18780, S = 'http://127.0.0.1:' + PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18779', U_DATA_DIR: DATA }, stdio: 'ignore' });
const mk = (file, port) => http.createServer((req, res) => {
  fs.readFile(file, (e, b) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(b); });
}).listen(port);
const sNew = mk(path.join(ROOT, 'index.html'), SITE);
const sOld = mk(OLDFILE, SITE + 1);
async function redCount(page, buf) {
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0, maxD = 0;
    for (let i = 0; i < d.length; i += 4) { const dm = d[i] - Math.max(d[i + 1], d[i + 2]); if (dm >= 4) { n++; if (dm > maxD) maxD = dm; } }
    return { n, maxD };
  }, buf.toString('base64'));
}
let browser; const out = {};
async function measure(port) {
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 3 })).newPage();
  await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => {
    localStorage.setItem('u-server', 'http://127.0.0.1:18949');
    localStorage.setItem('u-theme', 'dark');
    const now = Date.now();
    localStorage.setItem('u-msgs', JSON.stringify([{ id: 'dm_a', type: 'dm', text: '111', createdAt: now - 20000, read: false, user: { name: '111', handle: '111', key: 'u_111' } }]));
  });
  await page.evaluate(() => { const b = document.querySelector('#guestBtn'); if (b) b.click(); });
  await sleep(2500);
  await page.evaluate(() => { const t = document.querySelector('.tab[data-tab="dm"]'); if (t) t.click(); });
  await sleep(900);
  const box = await page.evaluate(() => { const r = document.querySelector('.swipe').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const clip = { x: Math.max(0, box.x + box.w - 40), y: box.y - 4, width: 44, height: box.h + 8 };
  const closed = await redCount(page, await page.screenshot({ clip }));
  // 真实拖拽：从左往右滑 90px
  const cy = box.y + box.h / 2;
  await page.mouse.move(box.x + box.w - 40, cy);
  await page.mouse.down();
  await page.mouse.move(box.x + box.w - 110, cy, { steps: 8 });
  const midOp = await page.evaluate(() => getComputedStyle(document.querySelector('.swipe-del')).opacity);
  const midRed = await redCount(page, await page.screenshot({ clip }));
  await page.mouse.up();
  await sleep(600);
  const after = await page.evaluate(() => ({ cls: document.querySelector('.swipe').className, op: getComputedStyle(document.querySelector('.swipe-del')).opacity, w: Math.round(document.querySelector('.swipe .msg-row').getBoundingClientRect().width), total: Math.round(document.querySelector('.swipe').getBoundingClientRect().width) }));
  const afterRed = await redCount(page, await page.screenshot({ clip }));
  await page.context().close();
  return { clipClosed: closed, midOp, midRed, after, afterRed };
}
(async () => {
  for (let i = 0; i < 90; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }
  browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  out.neu = await measure(SITE);
  out.old = await measure(SITE + 1);
  console.log(JSON.stringify(out));
})().catch((e) => console.log(JSON.stringify({ fatal: String(e).slice(0, 200) }))).finally(async () => { try { await browser.close(); } catch (e) {} sNew.close(); sOld.close(); srv.kill(); });
