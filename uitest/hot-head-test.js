
const { chromium } = require('playwright-core');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..'); const SITE = 18786;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const site = http.createServer((q, s) => fs.readFile(path.join(ROOT, 'index.html'), (e, b) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); s.end(b); })).listen(SITE);
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
  await page.goto('http://127.0.0.1:' + SITE + '/', { waitUntil: 'load', timeout: 40000 });
  await page.evaluate(() => { const b = document.querySelector('#guestBtn'); if (b) b.click(); });
  await sleep(2500);
  await page.evaluate(() => { const t = document.querySelector('.tab[data-tab="search"]'); if (t) t.click(); });
  await sleep(1500);
  const info = await page.evaluate(() => {
    const head = document.querySelector('#hotRank .hot-rank-head') || document.querySelector('.hot-rank-head');
    return { text: head ? head.innerText.replace(/\n/g, ' | ') : null, hasSub: !!(head && head.querySelector('.hr-sub')), items: document.querySelectorAll('#hotRank .hot-item').length };
  });
  const box = await page.evaluate(() => { const h = document.querySelector('.hot-rank-head'); if (!h) return null; const r = h.getBoundingClientRect(); return { x: 0, y: Math.max(0, r.y - 90), w: 420, h: 220 }; });
  if (box) await page.screenshot({ path: path.join(ROOT, '.tmp-test', 'hot-head.png'), clip: box });
  console.log(JSON.stringify({ info, errs }));
  await browser.close();
})().catch((e) => console.log(JSON.stringify({ fatal: String(e).slice(0, 160) }))).finally(() => site.close());
