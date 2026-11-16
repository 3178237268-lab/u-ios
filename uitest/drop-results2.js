
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'rdrop2-data');
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const PORT = 18929, SITE = 18786;
const S = 'http://127.0.0.1:' + PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18785', U_DATA_DIR: DATA }, stdio: 'ignore' });
const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const f = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(b); });
}).listen(SITE);
let pass = 0, fail = 0;
function ok(c, n, x) { if (c) pass++; else { fail++; console.log('FAIL ' + n + ' :: ' + JSON.stringify(x)); } }
(async () => {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.goto('http://127.0.0.1:' + SITE + '/', { waitUntil: 'load', timeout: 40000 });
  await page.evaluate((s) => { localStorage.setItem('u-server', s); localStorage.removeItem('u-search-hist'); }, S);
  await page.reload({ waitUntil: 'load' }); await sleep(600);
  const g = await page.$('#guestBtn'); if (g) { await g.click(); await sleep(1200); }
  await page.click('.tab[data-tab="search"]'); await sleep(400);
  const drop = () => page.evaluate(() => {
    const d = document.querySelector('#searchDrop'), cs = getComputedStyle(d);
    return { open: document.querySelector('#viewSearch').classList.contains('search-hist-open'),
      h: Math.round(d.getBoundingClientRect().height), op: cs.opacity, display: cs.display,
      rows: document.querySelectorAll('#searchSug .sug-row').length,
      resH: Math.round(document.querySelector('#searchResults').getBoundingClientRect().height) };
  });
  // 进二级页
  await page.fill('#searchInput', '好'); await sleep(350);
  await page.press('#searchInput', 'Enter'); await sleep(700);
  const inResults = await drop();
  ok(inResults.h <= 4, '二级页初始没有下拉框', inResults);
  ok(inResults.resH > 0, '二级页有结果列表', inResults);
  // 点搜索框 → 下拉出现
  await page.click('.search-box'); await sleep(500);
  const openedOnResults = await drop();
  ok(openedOnResults.open === true && openedOnResults.h > 40, '二级页点搜索框出现下拉框', openedOnResults);
  ok(openedOnResults.op === '1', '下拉框完全不透明', openedOnResults);
  ok(openedOnResults.rows >= 1, '下拉框里有建议条目', openedOnResults);
  ok(openedOnResults.resH > 0, '下拉展开时结果仍在', openedOnResults);
  await page.screenshot({ path: path.join(ROOT, '.tmp-test', 'drop-results-open.png') });
  // 点建议 → 仍留在二级页，下拉收起
  const uRow = await page.$('#searchSug .sug-row[data-sgo], #searchSug .sug-row[data-sgp], #searchSug .sug-row[data-sgu]');
  ok(!!uRow, '存在可点的建议行', null);
  if (uRow) { await uRow.click(); await sleep(800); }
  const afterPick = await page.evaluate(() => ({ cls: document.querySelector('#viewSearch').className, resH: Math.round(document.querySelector('#searchResults').getBoundingClientRect().height) }));
  ok(afterPick.cls.indexOf('search-results-mode') > -1, '点建议后仍在二级页', afterPick);
  ok(afterPick.cls.indexOf('search-hist-open') === -1, '点建议后下拉收起', afterPick);
  // 再开 → 点结果区域收起
  await page.click('.search-box'); await sleep(450);
  const reopened = await drop();
  ok(reopened.open === true && reopened.h > 40, '可再次展开', reopened);
  await page.click('#searchResults'); await sleep(400);
  const closedByResults = await drop();
  ok(closedByResults.open === false && closedByResults.h <= 4, '点结果区域收起下拉', closedByResults);
  // 返回键回首页，下拉仍可用
  await page.click('#searchBack'); await sleep(500);
  const home = await page.evaluate(() => document.querySelector('#viewSearch').className);
  ok(home.indexOf('search-results-mode') === -1, '返回键回搜索首页', home);
  await page.click('.search-box'); await sleep(450);
  const homeDrop = await drop();
  ok(homeDrop.open === true && homeDrop.h > 40, '首页下拉仍正常', homeDrop);
  ok(errs.length === 0, '无 pageerror', errs);
  console.log('RESULT pass=' + pass + ' fail=' + fail);
  await browser.close(); site.close(); srv.kill();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('ERROR ' + e); process.exit(2); });