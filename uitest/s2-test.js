
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'ui-search-data');
fs.rmSync(DATA, { recursive: true, force: true });
fs.mkdirSync(DATA, { recursive: true });
const PORT = 18909;
const S = 'http://127.0.0.1:' + PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18797', U_DATA_DIR: DATA }, stdio: 'ignore' });
let pass = 0, fail = 0;
function ok(c, n, x) { if (c) pass++; else { fail++; console.log('FAIL ' + n + ' :: ' + JSON.stringify(x)); } }
(async () => {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 220)));
  await page.goto('http://127.0.0.1:8765/', { waitUntil: 'load', timeout: 40000 });
  await page.evaluate((s) => { localStorage.setItem('u-server', s); localStorage.removeItem('u-search-hist'); }, S);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await page.click('#guestBtn').catch(() => {});
  await page.waitForTimeout(2200);
  await page.click('.tab[data-tab="search"]');
  await page.waitForTimeout(900);

  const vis = (sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) return 'missing'; const cs = getComputedStyle(el); return cs.display === 'none' || cs.visibility === 'hidden' || el.offsetParent === null ? 'hidden' : 'visible'; }, sel);
  const mode = () => page.evaluate(() => document.querySelector('#viewSearch').className);

  ok((await vis('#hotRank')) === 'visible', 'home shows hot rank', await vis('#hotRank'));
  ok((await vis('#searchResults')) === 'hidden', 'home hides results', await vis('#searchResults'));
  ok((await vis('#searchHist')) === 'hidden', 'home hides history before click', await vis('#searchHist'));
  ok((await vis('#searchBack')) === 'hidden', 'home hides back button', await vis('#searchBack'));

  await page.click('.search-box');
  await page.waitForTimeout(250);
  ok((await mode()).indexOf('search-hist-open') >= 0, 'click box opens history class', await mode());

  await page.fill('#searchInput', 'u');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1400);

  ok((await mode()).indexOf('search-results-mode') >= 0, 'results mode after search', await mode());
  ok((await vis('#searchBack')) === 'visible', 'back button visible on results', await vis('#searchBack'));
  ok((await vis('#hotRank')) === 'hidden', 'results hides hot rank', await vis('#hotRank'));
  ok((await vis('#searchResults')) === 'visible', 'results shows results box', await vis('#searchResults'));
  const kw = await page.evaluate(() => (document.querySelector('#searchKeyword') || {}).textContent || '');
  ok(kw.indexOf('u') >= 0, 'keyword label', kw);
  const pos = await page.evaluate(() => { const b = document.querySelector('#searchBack'); const r = b.getBoundingClientRect(); const v = document.querySelector('#viewSearch').getBoundingClientRect(); return { dx: Math.round(r.left - v.left), dy: Math.round(r.top - v.top), w: Math.round(r.width) }; });
  ok(pos.dx < 90 && pos.dy < 120 && pos.w >= 30, 'back button top-left', pos);

  await page.click('#searchBack');
  await page.waitForTimeout(700);
  ok((await mode()).indexOf('search-results-mode') < 0, 'back returns home mode', await mode());
  ok((await vis('#hotRank')) === 'visible', 'home hot rank back', await vis('#hotRank'));
  ok((await page.inputValue('#searchInput')) === '', 'input cleared after back');
  const histCount = await page.evaluate(() => document.querySelectorAll('#searchHist .hist-chip').length);
  ok(histCount >= 1, 'history recorded', histCount);
  ok((await vis('#searchHist')) === 'hidden', 'history hidden until box clicked', await vis('#searchHist'));
  await page.click('.search-box');
  await page.waitForTimeout(300);
  ok((await vis('#searchHist')) === 'visible', 'history shows after clicking box', await vis('#searchHist'));

  console.log(JSON.stringify({ pass, fail, errs: errs.slice(0, 4), histCount, kw, pos }));
  await browser.close();
  srv.kill();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('ERR ' + (e && e.stack || e)); try { srv.kill(); } catch (x) {} process.exit(2); });
