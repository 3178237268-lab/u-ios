
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'shot10-data');
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const PORT = 18929, SITE = 18801;
const S = 'http://127.0.0.1:' + PORT, PAGE = 'http://127.0.0.1:' + SITE + '/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18793', U_DATA_DIR: DATA }, stdio: 'ignore' });
const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const file = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p);
  fs.readFile(file, (e, buf) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(buf); });
}).listen(SITE);
(async () => {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, hasTouch: true, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.goto(PAGE, { waitUntil: 'load', timeout: 40000 });
  await page.evaluate((s) => { localStorage.setItem('u-server', s); localStorage.setItem('u-theme', 'dark'); localStorage.removeItem('u-dm-hidden'); }, S);
  await page.reload({ waitUntil: 'load' }); await sleep(800);
  const gb = await page.$('#guestBtn'); if (gb) { await gb.click(); await sleep(1400); }
  await page.evaluate(() => { const now = Date.now(); localStorage.setItem('u-msgs', JSON.stringify([
    { id: 'dm_a', type: 'dm', text: '冒昧打扰一下，请想请教一下，那种照片是怎么拍的', createdAt: now - 60000, read: false, user: { name: '阿柚', handle: 'bot_04', key: 'u_a' } },
    { id: 'dm_b', type: 'dm', text: '第二个会话内容也在这里', createdAt: now - 300000, read: true, user: { name: '栗子汽水', handle: 'bot_00', key: 'u_b' } },
    { id: 'dm_c', type: 'dm', text: '第三个会话', createdAt: now - 600000, read: true, user: { name: '小满', handle: 'x', key: 'u_c' } }])); });
  await page.click('.tab[data-tab="dm"]'); await sleep(900);
  await page.evaluate(() => { window.scrollTo(0, 0); const l = document.querySelector('#dmList'); if (l) l.scrollTop = 0; });
  await sleep(400);
  const box = await page.evaluate(() => { const r = document.querySelector('#dmList .msg-row').getBoundingClientRect(); return { x: Math.round(r.left + r.width - 80), y: Math.round(r.top + r.height / 2) }; });
  await page.mouse.move(box.x, box.y); await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(box.x - i * 18, box.y); await sleep(18); }
  await page.mouse.up(); await sleep(600);
  const info = await page.evaluate(() => {
    const w = document.querySelector('.swipe.open');
    if (!w) return null;
    const r = w.querySelector('.msg-row').getBoundingClientRect(), d = w.querySelector('.swipe-del').getBoundingClientRect(), wr = w.getBoundingClientRect();
    return { rowW: Math.round(r.width), delW: Math.round(d.width), gap: Math.round(d.left - r.right), wrapW: Math.round(wr.width), top: Math.round(wr.top - 10), h: Math.round(wr.height + 20) };
  });
  console.log('INFO ' + JSON.stringify(info) + ' errs=' + JSON.stringify(errs));
  if (info) await page.screenshot({ path: path.join(__dirname, '..', '.tmp-test', 'swipe-dark-open.png'), clip: { x: 0, y: Math.max(0, info.top), width: 420, height: info.h } });
  await browser.close(); site.close(); srv.kill(); process.exit(0);
})().catch(e => { console.log('ERROR ' + e); process.exit(2); });
