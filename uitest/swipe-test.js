
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'swipe-data');
fs.rmSync(DATA, { recursive: true, force: true });
fs.mkdirSync(DATA, { recursive: true });
const PORT = 18923, SITE = 18798;
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
function ok(c, n, x) { if (c) pass++; else { fail++; console.log('FAIL ' + n + ' :: ' + JSON.stringify(x)); } }
(async () => {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 240)));
  await page.goto(PAGE, { waitUntil: 'load', timeout: 40000 });
  await page.evaluate((s) => { localStorage.setItem('u-server', s); localStorage.removeItem('u-dm-hidden'); }, S);
  await page.reload({ waitUntil: 'load' });
  await sleep(600);
  // 游客登录
  const guestBtn = await page.$('#guestBtn');
  if (guestBtn) { await guestBtn.click(); await sleep(1200); }
  // 写入两条本地私信会话
  await page.evaluate(() => {
    const now = Date.now();
    localStorage.setItem('u-msgs', JSON.stringify([
      { id: 'dm_a', type: 'dm', text: '冒昧打扰一下，你那边今天下雨了吗', createdAt: now - 60000, read: false, user: { name: '栗子汽水', handle: 'lizi', key: 'u_lizi' } },
      { id: 'dm_b', type: 'dm', text: '第二条会话', createdAt: now - 120000, read: true, user: { name: '小满', handle: 'xiaoman', key: 'u_xiaoman' } }
    ]));
  });
  // 切到私信页
  await page.waitForSelector('.tab[data-tab="dm"]', { timeout: 10000 });
  await page.click('.tab[data-tab="dm"]');
  await sleep(700);
  const rows = await page.$$eval('#dmList .swipe', (els) => els.length);
  ok(rows >= 2, '私信行包了 swipe 容器', rows);
  const delOk = await page.evaluate(() => {
    const d = document.querySelector('.swipe .swipe-del');
    const r = document.querySelector('.swipe .msg-row');
    if (!d || !r) return { ok: false };
    const dr = d.getBoundingClientRect(), rr = r.getBoundingClientRect();
    const cs = getComputedStyle(d);
    const hit = document.elementFromPoint(dr.left + dr.width / 2, dr.top + dr.height / 2);
    return { ok: true, w: Math.round(dr.width), z: cs.zIndex, br: cs.borderTopRightRadius,
      covered: !!(hit && hit.closest('.msg-row')), rowRight: Math.round(rr.right), delLeft: Math.round(dr.left) };
  });
  ok(delOk.ok && delOk.w === 84, '删除按钮宽 84px', delOk);
  ok(delOk.covered === true, '收起时删除按钮被会话行盖住（不挡住点击）', delOk);
  // 收起态 transform
  const t0 = await page.evaluate(() => getComputedStyle(document.querySelector('.swipe .msg-row')).transform);
  ok(t0 === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(t0), '默认未偏移', t0);
  // 左滑打开
  const box = await page.evaluate(() => { const r = document.querySelector('.swipe .msg-row').getBoundingClientRect(); return { x: r.left + r.width - 40, y: r.top + r.height / 2 }; });
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(box.x - i * 13, box.y); await sleep(16); }
  await page.mouse.up();
  await sleep(420);
  const opened = await page.evaluate(() => {
    const w = document.querySelector('.swipe');
    const r = w.querySelector('.msg-row');
    return { open: w.classList.contains('open'), tr: getComputedStyle(r).transform };
  });
  ok(opened.open === true, '左滑后会话行展开', opened);
  ok(/-84/.test(opened.tr), '会话行左移 84px', opened.tr);
  // 打开状态下右滑收起
  await page.mouse.move(box.x - 100, box.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(box.x - 100 + i * 14, box.y); await sleep(16); }
  await page.mouse.up();
  await sleep(420);
  const closed = await page.evaluate(() => document.querySelector('.swipe').classList.contains('open'));
  ok(closed === false, '右滑收起', closed);
  // 竖滑不展开
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) { await page.mouse.move(box.x - 4, box.y + i * 10); await sleep(16); }
  await page.mouse.up();
  await sleep(300);
  ok((await page.evaluate(() => document.querySelector('.swipe').classList.contains('open'))) === false, '竖向滑动不触发删除面板', null);
  // 点删除
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(box.x - i * 13, box.y); await sleep(16); }
  await page.mouse.up();
  await sleep(420);
  const delPos = await page.evaluate(() => { const d = document.querySelector('.swipe.open .swipe-del'); if (!d) return null; const r = d.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  ok(!!delPos, '删除按钮已露出', delPos);
  if (delPos) { await page.mouse.click(delPos.x, delPos.y); await sleep(500); }
  const after = await page.evaluate(() => ({
    rows: document.querySelectorAll('#dmList .swipe').length,
    ids: JSON.parse(localStorage.getItem('u-msgs') || '[]').map((m) => m.id),
    hide: localStorage.getItem('u-dm-hidden')
  }));
  ok(after.rows === 1, '删除后只剩一条会话', after.rows);
  ok(after.ids.indexOf('dm_a') === -1, '本地缓存里该私信已删除', after.ids);
  ok(!!after.hide && after.hide.indexOf('mid:dm_a') > -1, '已记录隐藏标记', after.hide);
  ok(errs.length === 0, '无 pageerror', errs);
  console.log('RESULT pass=' + pass + ' fail=' + fail);
  await browser.close();
  site.close();
  srv.kill();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('ERROR ' + e); process.exit(2); });
