
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'swipe4-data');
fs.rmSync(DATA, { recursive: true, force: true });
fs.mkdirSync(DATA, { recursive: true });
const PORT = 18925, SITE = 18795;
const S = 'http://127.0.0.1:' + PORT, PAGE = 'http://127.0.0.1:' + SITE + '/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18796', U_DATA_DIR: DATA }, stdio: 'ignore' });
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
function ok(c, n, x) { if (c) pass++; else { fail++; console.log('FAIL ' + n + ' :: ' + JSON.stringify(x)); } }

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
  await page.goto(PAGE, { waitUntil: 'load', timeout: 40000 });
  await page.evaluate((s) => { localStorage.setItem('u-server', s); localStorage.removeItem('u-dm-hidden'); }, S);
  await page.reload({ waitUntil: 'load' });
  await sleep(600);
  const guestBtn = await page.$('#guestBtn');
  if (guestBtn) { await guestBtn.click(); await sleep(1200); }
  await page.evaluate(() => {
    const now = Date.now();
    localStorage.setItem('u-msgs', JSON.stringify([
      { id: 'dm_a', type: 'dm', text: '冒昧打扰一下，你那边今天下雨了吗', createdAt: now - 60000, read: false, user: { name: '栗子汽水', handle: 'lizi', key: 'u_lizi' } },
      { id: 'dm_b', type: 'dm', text: '第二条会话', createdAt: now - 120000, read: true, user: { name: '小满', handle: 'xiaoman', key: 'u_xiaoman' } }
    ]));
  });
  await page.waitForSelector('.tab[data-tab="dm"]', { timeout: 10000 });
  await page.click('.tab[data-tab="dm"]');
  await sleep(700);

  console.log('STAGE dm-ready rows=' + await page.$eval('#dmList .swipe', els => els.length));
  const geo0 = await page.evaluate(() => {
    const w = document.querySelector('.swipe'), d = w.querySelector('.swipe-del'), r = w.querySelector('.msg-row');
    const wr = w.getBoundingClientRect(), dr = d.getBoundingClientRect();
    return { wrapW: Math.round(wr.width), delW: Math.round(dr.width), gapRight: Math.round(wr.right - dr.right) };
  });
  ok(geo0.delW === 84, '删除块宽 84px', geo0);
  ok(geo0.gapRight === 0, '删除块贴住容器右侧（缝留在左边）', geo0);

  const box = await page.evaluate(() => { const r = document.querySelector('.swipe .msg-row').getBoundingClientRect(); return { x: r.left + r.width - 40, y: r.top + r.height / 2 }; });

  // 左滑：行程 + 展开后几何
  await touchDrag(cdp, box.x, box.y, box.x - 160, box.y, 8);
  await sleep(480);
  const open1 = await page.evaluate(() => {
    const w = document.querySelector('.swipe'), r = w.querySelector('.msg-row'), d = w.querySelector('.swipe-del');
    const wr = w.getBoundingClientRect(), rr = r.getBoundingClientRect(), dr = d.getBoundingClientRect();
    return { open: w.classList.contains('open'), travel: Math.round(wr.width - rr.width), gap: Math.round(dr.left - rr.right), delW: Math.round(dr.width), op: Number(getComputedStyle(d).opacity) };
  });
  console.log('STAGE after-left-swipe ' + JSON.stringify(open1) + ' rows=' + await page.$eval('#dmList .swipe', els => els.length));
  ok(open1.open === true, '触摸左滑展开', open1);
  ok(open1.travel === 92, '左滑极限正好 92px（与图片位置一致）', open1);
  ok(open1.gap === 8, '行与删除块之间留 8px 缝', open1);
  ok(open1.delW === 84 && open1.op > 0.9, '删除块完整露出', open1);

  // 已展开行再拖动：位置连续（不因 w0 取错而跳变）
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x - 60, y: box.y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x - 50, y: box.y, id: 1 }] });
  await sleep(40);
  const mid = await page.evaluate(() => { const w = document.querySelector('.swipe'), r = w.querySelector('.msg-row'); return { travel: Math.round(w.getBoundingClientRect().width - r.getBoundingClientRect().width) }; });
  ok(mid.travel <= 94 && mid.travel >= 76, '已展开的行再拖动时连续（不跳变）', mid);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + 90, y: box.y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(450);
  console.log('STAGE before-drag-right exists=' + await page.$eval('.swipe', els => els.length));
  ok((await page.evaluate(() => { const w = document.querySelector('.swipe'); return !w || !w.classList.contains('open'); })) === true, '右滑收起行', null);

  // 行上右滑不拉抽屉
  await touchDrag(cdp, box.x, box.y, box.x - 140, box.y, 8);
  await sleep(450);
  await touchDrag(cdp, box.x - 100, box.y, box.x + 30, box.y, 8);
  await sleep(450);
  const afterRight = await page.evaluate(() => ({ drawer: document.querySelector('#sideDrawer').classList.contains('open'), open: !!(document.querySelector('.swipe') && document.querySelector('.swipe').classList.contains('open')) }));
  ok(afterRight.drawer === false, '私信行上右滑不会拉出二级菜单', afterRight);
  ok(afterRight.open === false, '这次右滑用于收起会话行', afterRight);

  // 行展开时背景右滑：先收行，再滑才开菜单
  await touchDrag(cdp, box.x, box.y, box.x - 140, box.y, 8);
  await sleep(450);
  const emptyY = await page.evaluate(() => { const rows = document.querySelectorAll('#dmList .swipe'); const last = rows[rows.length - 1].getBoundingClientRect(); return Math.min(860, last.bottom + 120); });
  await touchDrag(cdp, 18, emptyY, 170, emptyY, 8);
  await sleep(450);
  const bg1 = await page.evaluate(() => ({ drawer: document.querySelector('#sideDrawer').classList.contains('open'), open: !!(document.querySelector('.swipe') && document.querySelector('.swipe').classList.contains('open')) }));
  ok(bg1.open === false && bg1.drawer === false, '行展开时背景右滑先收起行（不拉菜单）', bg1);
  await touchDrag(cdp, 18, emptyY, 220, emptyY, 8);
  await sleep(600);
  const bg2 = await page.evaluate(() => document.querySelector('#sideDrawer').classList.contains('open'));
  ok(bg2 === true, '再右滑一次正常打开二级菜单', bg2);

  // 收起抽屉后再验证：正常状态左滑仍可用
  await page.evaluate(() => document.querySelector('#sideDrawer').classList.remove('open'));
  await sleep(300);
  await touchDrag(cdp, box.x, box.y, box.x - 140, box.y, 8);
  await sleep(450);
  const again = await page.evaluate(() => { const w = document.querySelector('.swipe'); if (!w) return { open: false, travel: -1 }; const r = w.querySelector('.msg-row'); return { open: w.classList.contains('open'), travel: Math.round(w.getBoundingClientRect().width - r.getBoundingClientRect().width) }; });
  ok(again.open === true && again.travel === 92, '关闭抽屉后左滑删除仍正常', again);

  ok(errs.length === 0, '无 pageerror', errs);
  console.log('RESULT pass=' + pass + ' fail=' + fail);
  await browser.close();
  site.close();
  srv.kill();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('ERROR ' + e); process.exit(2); });