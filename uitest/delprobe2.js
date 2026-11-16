
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'delprobe-data');
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const PORT = 18927, SITE = 18799;
const S = 'http://127.0.0.1:' + PORT, PAGE = 'http://127.0.0.1:' + SITE + '/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18795', U_DATA_DIR: DATA }, stdio: 'ignore' });
const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const file = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p);
  fs.readFile(file, (e, buf) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(buf); });
}).listen(SITE);
(async () => {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, hasTouch: true })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.goto(PAGE, { waitUntil: 'load', timeout: 40000 });
  await page.evaluate((s) => { localStorage.setItem('u-server', s); localStorage.removeItem('u-dm-hidden'); }, S);
  await page.reload({ waitUntil: 'load' }); await sleep(700);
  const gb = await page.$('#guestBtn'); if (gb) { await gb.click(); await sleep(1300); }
  await page.evaluate(() => { const now = Date.now(); localStorage.setItem('u-msgs', JSON.stringify([
    { id: 'dm_a', type: 'dm', text: '第一条', createdAt: now - 60000, read: false, user: { name: '栗子汽水', handle: 'lizi', key: 'u_lizi' } },
    { id: 'dm_b', type: 'dm', text: '第二条', createdAt: now - 120000, read: true, user: { name: '小满', handle: 'xiaoman', key: 'u_xiaoman' } }])); });
  await page.click('.tab[data-tab="dm"]'); await sleep(800);
  const box = await page.evaluate(() => { const r = document.querySelector('.swipe .msg-row').getBoundingClientRect(); return { x: Math.round(r.left + r.width - 60), y: Math.round(r.top + r.height / 2) }; });
  await page.mouse.move(box.x, box.y); await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(box.x - i * 16, box.y); await sleep(16); }
  await page.mouse.up(); await sleep(500);
  const probe = await page.evaluate(() => {
    const w = document.querySelector('.swipe.open'); if (!w) return { open: false };
    const d = w.querySelector('.swipe-del'), r = w.querySelector('.msg-row');
    const dr = d.getBoundingClientRect(), rr = r.getBoundingClientRect();
    const cx = dr.left + dr.width / 2, cy = dr.top + dr.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    return { open: true, delRect: [Math.round(dr.left), Math.round(dr.right), Math.round(dr.width)], rowRight: Math.round(rr.right), cx: Math.round(cx), cy: Math.round(cy), hit: hit ? (hit.className || hit.tagName) : null, pe: getComputedStyle(d).pointerEvents, op: getComputedStyle(d).opacity };
  });
  console.log('PROBE ' + JSON.stringify(probe));
  if (probe.open) {
    await page.evaluate(() => {
      window.__clicks = [];
      document.addEventListener('click', function (e) {
        window.__clicks.push({ phase: 'doc-capture', cls: (e.target && e.target.className) || '', attr: e.target && e.target.getAttribute && e.target.getAttribute('data-dmdel'), prevented: e.defaultPrevented });
      }, true);
      var list = document.getElementById('dmList');
      window.__bound = !!(list && list._swipeBound);
      ['pointerdown', 'pointerup', 'click'].forEach(function (t) {
        (list || document).addEventListener(t, function (e) {
          window.__clicks.push({ phase: t + '-list', cls: (e.target && e.target.className) || '', attr: e.target && e.target.getAttribute && e.target.getAttribute('data-dmdel') });
        }, true);
      });
    });
    await page.mouse.click(probe.cx, probe.cy);
    await sleep(700);
    const after = await page.evaluate(() => ({ rows: document.querySelectorAll('#dmList .swipe').length, ids: JSON.parse(localStorage.getItem('u-msgs') || '[]').map(m => m.id), hide: localStorage.getItem('u-dm-hidden') }));
    console.log('AFTER ' + JSON.stringify(after));
    console.log('CLICKS ' + JSON.stringify(await page.evaluate(() => ({ bound: window.__bound, list: window.__clicks }))));
  }
  console.log('ERRS ' + JSON.stringify(errs));
  await browser.close(); site.close(); srv.kill(); process.exit(0);
})().catch(e => { console.log('ERR ' + e); process.exit(2); });