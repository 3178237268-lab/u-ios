
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'shot9-data');
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const PORT = 18928, SITE = 18800;
const S = 'http://127.0.0.1:' + PORT, PAGE = 'http://127.0.0.1:' + SITE + '/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18794', U_DATA_DIR: DATA }, stdio: 'ignore' });
const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const file = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p);
  fs.readFile(file, (e, buf) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(buf); });
}).listen(SITE);
let pass = 0, fail = 0;
function ok(c, n, x) { if (c) pass++; else { fail++; console.log('FAIL ' + n + ' :: ' + JSON.stringify(x)); } }
async function touchDrag(cdp, x0, y0, x1, y1, steps) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }] });
  for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / steps, y: y0 + (y1 - y0) * i / steps, id: 1 }] }); await sleep(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
(async () => {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.goto(PAGE, { waitUntil: 'load', timeout: 40000 });
  await page.evaluate((s) => { localStorage.setItem('u-server', s); localStorage.setItem('u-theme', 'dark'); localStorage.removeItem('u-dm-hidden'); }, S);
  await page.reload({ waitUntil: 'load' }); await sleep(800);
  const gb = await page.$('#guestBtn'); if (gb) { await gb.click(); await sleep(1400); }
  await page.evaluate(() => {
    const now = Date.now();
    const many = [];
    for (let i = 0; i < 6; i++) many.push({ id: 'dm_' + i, type: 'dm', text: i === 0 ? '冒昧打扰一下，你那边今天下雨了吗，我这边下了一整天。' : '第 ' + (i + 1) + ' 个会话', createdAt: now - (i + 1) * 60000, read: i > 0, user: { name: i === 0 ? '阿柚' : '小满', handle: i === 0 ? 'bot_04' : ('u' + i), key: 'u_k' + i } });
    localStorage.setItem('u-msgs', JSON.stringify(many));
  });
  await page.click('.tab[data-tab="dm"]'); await sleep(900);
  const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor + ' / theme=' + document.documentElement.className);
  console.log('THEME ' + dark);
  await page.evaluate(() => { window.scrollTo(0, 0); const l = document.querySelector('#dmList'); if (l) l.scrollTop = 0; });
  await sleep(500);
  const box = await page.evaluate(() => {
    const rows = Array.prototype.slice.call(document.querySelectorAll('#dmList .msg-row'));
    const r = rows.map(function (e) { return e.getBoundingClientRect(); }).filter(function (b) { return b.top > 80 && b.bottom < window.innerHeight - 80; })[0] || rows[0].getBoundingClientRect();
    return { x: Math.round(r.left + r.width - 60), y: Math.round(r.top + r.height / 2), top: Math.round(r.top), bottom: Math.round(r.bottom) };
  });
  await touchDrag(cdp, box.x, box.y, box.x - 170, box.y, 8);
  await sleep(600);
  const geo = await page.evaluate(() => {
    const w = document.querySelector('.swipe.open');
    if (!w) return null;
    const r = w.querySelector('.msg-row').getBoundingClientRect(), d = w.querySelector('.swipe-del').getBoundingClientRect(), wr = w.getBoundingClientRect();
    return { rowW: Math.round(r.width), rowRight: Math.round(r.right), delLeft: Math.round(d.left), delW: Math.round(d.width), wrapW: Math.round(wr.width), gap: Math.round(d.left - r.right) };
  });
  ok(!!geo && geo.gap === 8 && geo.delW === 84, '深色主题下几何一致', geo);
  await page.screenshot({ path: path.join(__dirname, '..', '.tmp-test', 'swipe-open-dark.png'), clip: { x: 0, y: Math.max(0, box.top - 70), width: 420, height: 230 } });

  // 竖向滑动仍然滚动页面（不被抽屉手势抢走）
  const before = await page.evaluate(() => { const el = document.querySelector('#dmList'); const sc = document.scrollingElement || document.documentElement; return { listTop: el.scrollTop, docTop: sc.scrollTop, h: sc.scrollHeight, ch: sc.clientHeight }; });
  await touchDrag(cdp, 200, box.bottom + 20, 200, box.bottom - 220, 8);
  await sleep(500);
  const after = await page.evaluate(() => { const sc = document.scrollingElement || document.documentElement; return { docTop: sc.scrollTop, drawer: document.querySelector('#sideDrawer').classList.contains('open') }; });
  ok(after.drawer === false, '竖滑不会打开抽屉', after);
  console.log('SCROLL before=' + JSON.stringify(before) + ' after=' + JSON.stringify(after));
  ok(errs.length === 0, '无 pageerror', errs);
  console.log('RESULT pass=' + pass + ' fail=' + fail);
  await browser.close(); site.close(); srv.kill(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('ERROR ' + e); process.exit(2); });