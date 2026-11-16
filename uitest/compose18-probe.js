
const { chromium } = require('playwright-core');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..'); const SITE = 18805;
const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const file = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p);
  fs.readFile(file, (e, buf) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(buf); });
}).listen(SITE);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 120)));
  await page.goto('http://127.0.0.1:' + SITE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(900);
  const gb = await page.$('#guestBtn'); if (gb) { await gb.click(); await page.waitForTimeout(1200); }
  // open composer
  const opened = await page.evaluate(() => {
    const btn = document.querySelector('[data-tab="compose"], #composeBtn, .tab-compose, #newPost');
    if (btn) { btn.click(); return 'clicked ' + (btn.id || btn.className); }
    const c = document.querySelector('#compose'); if (c) { c.classList.add('open'); return 'forced'; }
    return 'none';
  });
  await sleep(700);
  const before = await page.evaluate(() => {
    const g = document.querySelector('#gameSheet');
    return { game: g.className, vis: getComputedStyle(g).visibility, docH: document.documentElement.scrollHeight, appH: document.querySelector('#app').getBoundingClientRect().height, composeH: Math.round(document.querySelector('#compose').getBoundingClientRect().height) };
  });
  await page.evaluate(() => { const l = document.querySelector('#sensRow'); l.click(); });
  await sleep(500);
  const after = await page.evaluate(() => {
    const g = document.querySelector('#gameSheet');
    return { game: g.className, vis: getComputedStyle(g).visibility, docH: document.documentElement.scrollHeight, scrollY: window.scrollY, composeH: Math.round(document.querySelector('#compose').getBoundingClientRect().height) };
  });
  console.log('OPEN ' + opened);
  console.log('BEFORE ' + JSON.stringify(before));
  console.log('AFTER ' + JSON.stringify(after));
  console.log('ERRS ' + JSON.stringify(errs));
  await b.close(); site.close(); process.exit(0);
})().catch(e => { console.log('ERR ' + e); process.exit(2); });
