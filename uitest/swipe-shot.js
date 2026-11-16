
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'shot-data');
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const PORT = 18927, SITE = 18796;
const S = 'http://127.0.0.1:' + PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18795', U_DATA_DIR: DATA }, stdio: 'ignore' });
const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const f = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(b); });
}).listen(SITE);
(async () => {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 760 }, deviceScaleFactor: 2 })).newPage();
  await page.goto('http://127.0.0.1:' + SITE + '/', { waitUntil: 'load', timeout: 40000 });
  await page.evaluate((s) => { localStorage.setItem('u-server', s); localStorage.removeItem('u-dm-hidden'); }, S);
  await page.reload({ waitUntil: 'load' }); await sleep(700);
  const g = await page.$('#guestBtn'); if (g) { await g.click(); await sleep(1200); }
  await page.evaluate(() => {
    const now = Date.now();
    localStorage.setItem('u-msgs', JSON.stringify([
      { id: 'dm_a', type: 'dm', text: '冒昧打扰一下，你那边今天下雨了吗，我这边下了一整天。', createdAt: now - 60000, read: false, user: { name: '栗子汽水', handle: 'lizi', key: 'u_lizi' } },
      { id: 'dm_b', type: 'dm', text: '第二个会话', createdAt: now - 300000, read: true, user: { name: '小满', handle: 'xiaoman', key: 'u_xiaoman' } }
    ]));
  });
  await page.click('.tab[data-tab="dm"]'); await sleep(800);
  await page.screenshot({ path: path.join(ROOT, '.tmp-test', 'dmshot-closed.png') });
  const box = await page.evaluate(() => { const r = document.querySelector('.swipe .msg-row').getBoundingClientRect(); return { x: r.left + r.width - 40, y: r.top + r.height / 2 }; });
  await page.mouse.move(box.x, box.y); await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(box.x - i * 13, box.y); await sleep(16); }
  await page.mouse.up(); await sleep(500);
  await page.screenshot({ path: path.join(ROOT, '.tmp-test', 'dmshot-open.png') });
  await browser.close(); site.close(); srv.kill();
  console.log('shots done');
})().catch((e) => { console.log('ERR ' + e); process.exit(2); });
