
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'swipe7-data');
fs.rmSync(DATA, { recursive: true, force: true });
fs.mkdirSync(DATA, { recursive: true });
const PORT = 18926, SITE = 18798;
const S = 'http://127.0.0.1:' + PORT, PAGE = 'http://127.0.0.1:' + SITE + '/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18797', U_DATA_DIR: DATA }, stdio: 'ignore' });
const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const file = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p);
  fs.readFile(file, (e, buf) => {
    if (e) { res.writeHead(404); res.end('no'); return; }
    res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
    res.end(buf);
  });
}).listen(SITE);
let pass = 0, fail = 0;
const rows = [];
function ok(c, n, x) { if (c) { pass++; rows.push('ok   ' + n); } else { fail++; rows.push('FAIL ' + n + ' :: ' + JSON.stringify(x)); } }

async function touchDrag(cdp, x0, y0, x1, y1, steps) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / steps, y: y0 + (y1 - y0) * i / steps, id: 1 }] });
    await sleep(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

(async () => {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, hasTouch: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 240)));
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) errs.push('NAV ' + f.url()); });

  const state = () => page.evaluate(() => {
    const w = document.querySelector('.swipe');
    const d = document.querySelector('#sideDrawer');
    const r = w ? w.querySelector('.msg-row') : null;
    return {
      drawer: !!(d && d.classList.contains('open')),
      open: !!(w && w.classList.contains('open')),
      travel: (w && r) ? Math.round(w.getBoundingClientRect().width - r.getBoundingClientRect().width) : -1,
      gap: (w && r) ? Math.round(w.querySelector('.swipe-del').getBoundingClientRect().left - r.getBoundingClientRect().right) : -1,
      delW: w ? Math.round(w.querySelector('.swipe-del').getBoundingClientRect().width) : -1,
      delOp: w ? Number(getComputedStyle(w.querySelector('.swipe-del')).opacity) : -1,
      rowCount: document.querySelectorAll('#dmList .swipe').length
    };
  });

  await page.goto(PAGE, { waitUntil: 'load', timeout: 40000 });
  await page.evaluate((s) => { localStorage.setItem('u-server', s); localStorage.removeItem('u-dm-hidden'); }, S);
  await page.reload({ waitUntil: 'load' });
  await sleep(700);
  const guestBtn = await page.$('#guestBtn');
  if (guestBtn) { await guestBtn.click(); await sleep(1400); }
  await page.evaluate(() => {
    const now = Date.now();
    localStorage.setItem('u-msgs', JSON.stringify([
      { id: 'dm_a', type: 'dm', text: '冒昧打扰一下，你那边今天下雨了吗', createdAt: now - 60000, read: false, user: { name: '栗子汽水', handle: 'lizi', key: 'u_lizi' } },
      { id: 'dm_b', type: 'dm', text: '第二条会话', createdAt: now - 120000, read: true, user: { name: '小满', handle: 'xiaoman', key: 'u_xiaoman' } }
    ]));
  });
  await page.click('.tab[data-tab="dm"]');
  await sleep(800);
  const s0 = await state();
  ok(s0.rowCount >= 2, '私信行已渲染', s0);
  ok(s0.delW === 84 && s0.delOp === 0, '删除块 84px 且收起时隐藏', s0);

  const box = await page.evaluate(() => { const r = document.querySelector('.swipe .msg-row').getBoundingClientRect(); return { x: Math.round(r.left + r.width - 60), y: Math.round(r.top + r.height / 2) }; });

  await touchDrag(cdp, box.x, box.y, box.x - 160, box.y, 8);
  await sleep(500);
  const s1 = await state();
  ok(s1.open === true, '触摸左滑展开', s1);
  ok(s1.travel === 92, '左滑极限正好 92px（与图片位置一致）', s1);
  ok(s1.gap === 8, '行与删除块之间留 8px 缝', s1);
  ok(s1.delOp > 0.9, '删除块完整露出', s1);

  // 已展开行再拖动：连续不跳变
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x - 60, y: box.y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x - 50, y: box.y, id: 1 }] });
  await sleep(40);
  const s2 = await state();
  ok(s2.travel >= 76 && s2.travel <= 94, '已展开的行再拖动时位置连续', s2);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + 80, y: box.y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(500);
  const s3 = await state();
  ok(s3.open === false, '右滑把会话行收起', s3);
  ok(s3.drawer === false, '收起行时没有顺带打开二级菜单', s3);

  // 行上右滑（未展开）：不拉抽屉
  await touchDrag(cdp, box.x, box.y, box.x + 160, box.y, 8);
  await sleep(500);
  const s4 = await state();
  ok(s4.drawer === false, '私信行上右滑不会拉出二级菜单', s4);

  // 行展开时背景右滑：先收行
  await touchDrag(cdp, box.x, box.y, box.x - 160, box.y, 8);
  await sleep(500);
  const s5 = await state();
  ok(s5.open === true, '再次左滑展开（前置条件）', s5);
  const emptyY = await page.evaluate(() => { const list = document.querySelectorAll('#dmList .swipe'); const last = list[list.length - 1].getBoundingClientRect(); return Math.round(Math.min(860, last.bottom + 160)); });
  await touchDrag(cdp, 80, emptyY, 220, emptyY, 8);
  await sleep(500);
  const s6 = await state();
  ok(s6.open === false && s6.drawer === false, '行展开时背景右滑先收起行（不拉菜单）', s6);
  await touchDrag(cdp, 80, emptyY, 280, emptyY, 8);
  await sleep(700);
  const s7 = await state();
  ok(s7.drawer === true, '再右滑一次正常打开二级菜单', s7);

  await page.evaluate(() => { const d = document.querySelector('#sideDrawer'); if (d) d.classList.remove('open'); });
  await sleep(400);
  await touchDrag(cdp, box.x, box.y, box.x - 160, box.y, 8);
  await sleep(500);
  const s8 = await state();
  ok(s8.open === true && s8.travel === 92, '关掉抽屉后左滑删除仍正常', s8);

  ok(errs.filter((e) => !/^NAV /.test(e)).length === 0, '无 pageerror', errs);
  console.log(rows.join('\n'));
  console.log('NAV/ERR ' + JSON.stringify(errs));
  console.log('RESULT pass=' + pass + ' fail=' + fail);
  await browser.close();
  site.close();
  srv.kill();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('ERROR ' + e + '\n' + (e && e.stack)); console.log(rows.join('\n')); process.exit(2); });