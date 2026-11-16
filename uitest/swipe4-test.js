
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

// 合成触摸手势：从 (x0,y0) 拖到 (x1,y1)
async function touchDrag(page, x0, y0, x1, y1, steps) {
  await page.evaluate(([x0, y0, x1, y1, steps]) => {
    const at = (x, y) => document.elementFromPoint(x, y) || document.body;
    const mk = (type, x, y) => {
      const t = new Touch({ identifier: 1, target: at(x, y), clientX: x, clientY: y, pageX: x, pageY: y, screenX: x, screenY: y });
      const empty = (type === 'touchend' || type === 'touchcancel');
      const el = at(x, y);
      el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: empty ? [] : [t], targetTouches: empty ? [] : [t], changedTouches: [t] }));
    };
    mk('touchstart', x0, y0);
    for (let i = 1; i <= steps; i++) {
      const x = x0 + (x1 - x0) * i / steps, y = y0 + (y1 - y0) * i / steps;
      mk('touchmove', x, y);
    }
    mk('touchend', x1, y1);
  }, [x0, y0, x1, y1, steps]);
}

(async () => {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, hasTouch: true })).newPage();
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

  // 1) 删除块几何：宽 84、右侧留 8px 缝
  const geo0 = await page.evaluate(() => {
    const w = document.querySelector('.swipe'), d = w.querySelector('.swipe-del'), r = w.querySelector('.msg-row');
    const wr = w.getBoundingClientRect(), dr = d.getBoundingClientRect(), rr = r.getBoundingClientRect();
    return { wrapW: Math.round(wr.width), wrapRight: Math.round(wr.right), delW: Math.round(dr.width), gap: Math.round(wr.right - dr.right), rowW: Math.round(rr.width) };
  });
  ok(geo0.delW === 84, '删除块宽 84px', geo0);
  ok(geo0.gap === 8, '删除块距离容器右侧 8px（与图片一致的缝）', geo0);

  const box = await page.evaluate(() => { const r = document.querySelector('.swipe .msg-row').getBoundingClientRect(); return { x: r.left + r.width - 40, y: r.top + r.height / 2 }; });

  // 2) 左滑极限：拖过头也停在 92px 行程
  await page.mouse.move(box.x, box.y); await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(box.x - i * 20, box.y); await sleep(14); }
  const dragFar = await page.evaluate(() => { const w = document.querySelector('.swipe'), r = w.querySelector('.msg-row'); return { w: Math.round(r.getBoundingClientRect().width), wrap: Math.round(w.getBoundingClientRect().width) }; });
  ok(dragFar.wrap - dragFar.w <= 92 + 6, '拖过头时被阻尼限住（不无限拉伸）', dragFar);
  await page.mouse.up(); await sleep(420);
  const open1 = await page.evaluate(() => {
    const w = document.querySelector('.swipe'), r = w.querySelector('.msg-row'), d = w.querySelector('.swipe-del');
    const wr = w.getBoundingClientRect(), rr = r.getBoundingClientRect(), dr = d.getBoundingClientRect();
    const cs = getComputedStyle(d);
    return { open: w.classList.contains('open'), rowW: Math.round(rr.width), wrapW: Math.round(wr.width), gap: Math.round(dr.left - rr.right), delW: Math.round(dr.width), op: Number(cs.opacity), delRight: Math.round(wr.right - dr.right) };
  });
  ok(open1.open === true, '左滑后展开', open1);
  ok(open1.wrapW - open1.rowW === 92, '展开后行程正好 92px（图片位置）', open1);
  ok(open1.gap === 8, '展开后会话行与删除块之间有 8px 缝', open1);
  ok(open1.delW === 84 && open1.op > 0.9, '删除块完整露出', open1);

  // 3) 展开状态下按下行再右移：不跳到错误位置（w0 取容器宽）
  await page.mouse.move(box.x - 100, box.y); await page.mouse.down();
  await page.mouse.move(box.x - 90, box.y); await sleep(30);
  const midDrag = await page.evaluate(() => { const w = document.querySelector('.swipe'), r = w.querySelector('.msg-row'); return { w: Math.round(r.getBoundingClientRect().width), wrap: Math.round(w.getBoundingClientRect().width) }; });
  ok(midDrag.wrap - midDrag.w <= 92 && midDrag.wrap - midDrag.w >= 78, '已展开的行再拖动时位置连续（不跳变）', midDrag);
  for (let i = 1; i <= 8; i++) { await page.mouse.move(box.x - 90 + i * 14, box.y); await sleep(16); }
  await page.mouse.up(); await sleep(420);
  ok((await page.evaluate(() => document.querySelector('.swipe').classList.contains('open'))) === false, '右滑收起', null);

  // 4) 触摸左滑展开后，触摸右滑不拉出二级菜单，而是收起行
  await touchDrag(page, box.x, box.y, box.x - 120, box.y, 6);
  await sleep(450);
  const open2 = await page.evaluate(() => document.querySelector('.swipe').classList.contains('open'));
  ok(open2 === true, '触摸左滑也能展开', open2);
  await touchDrag(page, box.x - 120, box.y, box.x + 20, box.y, 6);
  await sleep(450);
  const afterRight = await page.evaluate(() => ({ drawer: document.querySelector('#sideDrawer').classList.contains('open'), open: document.querySelector('.swipe').classList.contains('open') }));
  ok(afterRight.drawer === false, '在私信行上右滑不会拉出二级菜单', afterRight);
  ok(afterRight.open === false, '右滑把会话行收起', afterRight);

  // 5) 行已展开时，从背景右滑：先收起行，不拉菜单；再滑一次才开菜单
  await touchDrag(page, box.x, box.y, box.x - 120, box.y, 6);
  await sleep(450);
  await touchDrag(page, 30, box.y, 160, box.y, 6);
  await sleep(400);
  const bg1 = await page.evaluate(() => ({ drawer: document.querySelector('#sideDrawer').classList.contains('open'), open: document.querySelector('.swipe').classList.contains('open') }));
  ok(bg1.open === false && bg1.drawer === false, '行展开时背景右滑先收起行', bg1);
  await touchDrag(page, 30, box.y, 200, box.y, 6);
  await sleep(500);
  const bg2 = await page.evaluate(() => document.querySelector('#sideDrawer').classList.contains('open'));
  ok(bg2 === true, '再右滑一次正常打开二级菜单', bg2);

  ok(errs.length === 0, '无 pageerror', errs);
  console.log('RESULT pass=' + pass + ' fail=' + fail);
  await browser.close();
  site.close();
  srv.kill();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('ERROR ' + e); process.exit(2); });
