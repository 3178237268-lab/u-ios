
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 's3-data');
fs.rmSync(DATA, { recursive: true, force: true });
fs.mkdirSync(DATA, { recursive: true });
const PORT = 18911, SITE = 18799;
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
const css = (page, sel, prop) => page.evaluate(([s, p]) => { const el = document.querySelector(s); return el ? getComputedStyle(el)[p] : 'missing'; }, [sel, prop]);
const mode = (page) => page.evaluate(() => document.querySelector('#viewSearch').className);
(async () => {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 220)));
  await page.goto(PAGE, { waitUntil: 'load', timeout: 40000 });
  await page.evaluate((s) => { localStorage.setItem('u-server', s); localStorage.removeItem('u-search-hist'); }, S);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1800);
  await page.click('#guestBtn').catch(() => {});
  await page.waitForTimeout(2200);
  const posted = await page.evaluate(async (s) => {
    const tok = localStorage.getItem('u-server-token');
    const texts = ['搜索下拉测试第一条 alpha', '搜索下拉测试第二条 beta', '完全无关的内容 gamma'];
    let n = 0;
    for (const t of texts) {
      const r = await fetch(s + '/api/posts', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: JSON.stringify({ text: t }) });
      if (r.ok) n++;
    }
    return { n, tok: !!tok };
  }, S);
  ok(posted.n === 3, 'seeded 3 posts', posted);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2600);
  await page.click('.tab[data-tab="search"]');
  await page.waitForTimeout(700);

  // 1. 关闭态
  ok((await css(page, '#searchSug', 'maxHeight')) === '0px', 'sug hidden before open', await css(page, '#searchSug', 'maxHeight'));
  const trans = await css(page, '.search-drop', 'transitionProperty');
  ok(trans.indexOf('max-height') >= 0, 'drop has transition', trans);

  // 2. 点搜索框 -> 下拉动画展开 + 历史可见
  await page.click('.search-box');
  await page.waitForTimeout(60);
  const mid = await css(page, '.search-drop', 'maxHeight');
  ok(mid !== '0px', 'drop animating open (mid height)', mid);
  await page.waitForTimeout(500);
  ok((await css(page, '.search-drop', 'opacity')) === '1', 'drop opacity 1', await css(page, '.search-drop', 'opacity'));
  ok((await page.evaluate(() => document.querySelector('#searchDrop').getBoundingClientRect().height)) > 0, 'drop has height');
  const posOrder = await page.evaluate(() => {
    const d = document.querySelector('#searchDrop').getBoundingClientRect();
    const b = document.querySelector('.search-box').getBoundingClientRect();
    const h = document.querySelector('#hotRank').getBoundingClientRect();
    return { gap: Math.round(d.top - b.bottom), above: d.top < h.top };
  });
  ok(posOrder.gap < 40 && posOrder.above, 'drop sits right under search box', posOrder);

  // 3. 输入：不跳二级页，下拉里出现建议
  await page.fill('#searchInput', '搜索下拉');
  await page.waitForTimeout(900);
  ok((await mode(page)).indexOf('search-results-mode') < 0, 'typing does NOT jump to results', await mode(page));
  const sug = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('#searchSug .sug-row'));
    return { n: rows.length, first: (rows[0] || {}).textContent, kinds: rows.map((r) => r.getAttribute('data-sgo') ? 'go' : r.getAttribute('data-sgu') ? 'user' : r.getAttribute('data-sgp') ? 'post' : '?') };
  });
  ok(sug.n >= 2, 'suggestions rendered', sug);
  ok(String(sug.first || '').indexOf('搜索') >= 0, 'first row is 搜索 q', sug.first);
  ok(sug.kinds.filter((k) => k === 'post').length >= 1, 'post suggestions present', sug.kinds);
  const dropH = await page.evaluate(() => document.querySelector('#searchSug').getBoundingClientRect().height);
  ok(dropH > 40, 'sug row area tall', dropH);

  // 4. 点击帖子条目 -> 跳二级页
  await page.click('#searchSug .sug-row[data-sgp]');
  await page.waitForTimeout(1200);
  ok((await mode(page)).indexOf('search-results-mode') >= 0, 'click sug row jumps to results', await mode(page));
  ok((await page.inputValue('#searchInput')) === '搜索下拉', 'input keeps keyword', await page.inputValue('#searchInput'));
  const nums = await page.evaluate(() => document.querySelectorAll('#searchResults .post').length);
  ok(nums >= 2, 'results page lists posts', nums);

  // 5. 返回键 -> home，下拉关闭且清空建议
  await page.click('#searchBack');
  await page.waitForTimeout(900);
  ok((await mode(page)).indexOf('search-results-mode') < 0, 'back to home', await mode(page));
  ok((await page.inputValue('#searchInput')) === '', 'input cleared');
  ok((await page.evaluate(() => document.querySelectorAll('#searchSug .sug-row').length)) === 0, 'sug cleared on back');

  // 6. Enter 也能进二级页
  await page.click('.search-box');
  await page.waitForTimeout(300);
  await page.fill('#searchInput', 'gamma');
  await page.waitForTimeout(700);
  ok((await mode(page)).indexOf('search-results-mode') < 0, 'still home before Enter', await mode(page));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  ok((await mode(page)).indexOf('search-results-mode') >= 0, 'Enter commits to results', await mode(page));

  console.log(JSON.stringify({ pass, fail, errs: errs.slice(0, 4), sug: sug.n, nums }));
  await browser.close();
  srv.kill(); site.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('ERR ' + (e && e.stack || e)); try { srv.kill(); site.close(); } catch (x) {} process.exit(2); });
