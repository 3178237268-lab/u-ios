
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'size-data');
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const PORT = 18913, SITE = 18798;
const S = 'http://127.0.0.1:' + PORT, PAGE = 'http://127.0.0.1:' + SITE + '/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18795', U_DATA_DIR: DATA }, stdio: 'ignore' });
const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const file = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p);
  fs.readFile(file, (e, buf) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(buf); });
}).listen(SITE);
let pass = 0, fail = 0;
const ok = (c, n, x) => { if (c) pass++; else { fail++; console.log('FAIL ' + n + ' :: ' + JSON.stringify(x)); } };
const m = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) return 'missing'; const cs = getComputedStyle(el); return { w: Math.round(el.getBoundingClientRect().width), fs: cs.fontSize }; }, sel);
(async () => {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.goto(PAGE, { waitUntil: 'load', timeout: 40000 });
  await page.evaluate((s) => { localStorage.setItem('u-server', s); }, S);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1600);
  await page.click('#guestBtn').catch(() => {});
  await page.waitForTimeout(2200);
  await page.evaluate(async (s) => {
    const tok = localStorage.getItem('u-server-token');
    const h = { 'content-type': 'application/json', authorization: 'Bearer ' + tok };
    const r = await fetch(s + '/api/posts', { method: 'POST', headers: h, body: JSON.stringify({ text: '头像和用户名放大测试 第20轮' }) });
    const d = await r.json();
    if (d && d.id) await fetch(s + '/api/posts/' + d.id + '/comments', { method: 'POST', headers: h, body: JSON.stringify({ text: '评论者头像也放大一点' }) });
  }, S);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);

  const postAv = await m(page, '.post .avatar');
  const head = await m(page, '.post .phead');
  ok(postAv.w === 44, 'post avatar 44px', postAv);
  ok(head.fs === '16px', 'post name 16px', head);

  await page.screenshot({ path: path.join(ROOT, '.tmp-test', 'size-feed.png') });

  // 打开帖子详情看评论头像
  await page.click('.post .ptext').catch(() => {});
  await page.waitForTimeout(1200);
  const cmtAv = await m(page, '.comment .avatar');
  const cmtHead = await m(page, '.comment .phead');
  ok(cmtAv.w === 40, 'comment avatar 40px', cmtAv);
  ok(cmtHead.fs === '16px', 'comment name 16px', cmtHead);
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(600);

  // 抽屉菜单
  await page.click('#menuBtn').catch(() => {});
  await page.waitForTimeout(900);
  const big = await m(page, '.side-head .avatar.big');
  const sname = await m(page, '.side-name');
  ok(big.w === 102, 'drawer avatar 102px', big);
  ok(sname.fs === '22px', 'drawer name 22px', sname);
  await page.screenshot({ path: path.join(ROOT, '.tmp-test', 'size-drawer.png') });
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(500);

  // 搜索页用户行
  await page.click('.tab[data-tab="search"]');
  await page.waitForTimeout(600);
  await page.click('.search-box');
  await page.fill('#searchInput', 'guest');
  await page.waitForTimeout(1200);
  const suf = await m(page, '#searchSug .sug-row');
  ok(suf.w > 0, 'sug row rendered', suf);

  console.log(JSON.stringify({ pass, fail, errs: errs.slice(0, 3), postAv, head, cmtAv, cmtHead, big, sname }));
  await browser.close(); srv.kill(); site.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('ERR ' + (e && e.stack || e)); try { srv.kill(); site.close(); } catch (x) {} process.exit(2); });
