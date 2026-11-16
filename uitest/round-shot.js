
const { chromium } = require('playwright-core');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const SITE = 18784, SRV = 'http://127.0.0.1:8787';
const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const f = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(b); });
}).listen(SITE);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.goto('http://127.0.0.1:' + SITE + '/', { waitUntil: 'load', timeout: 40000 });
  await page.evaluate((s) => { localStorage.setItem('u-server', s); }, SRV);
  await page.reload({ waitUntil: 'load' }); await sleep(900);
  const g = await page.$('#guestBtn'); if (g) { await g.click(); await sleep(1800); }
  await sleep(1500);
  const radii = await page.evaluate(() => {
    const pick = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).borderTopLeftRadius : 'none'; };
    return { post: pick('.post'), search: pick('.search-box'), tab: pick('.tabbar'), navIcon: pick('.iconbtn'), avatar: pick('.avatar'), msgRow: pick('.msg-row') };
  });
  await page.screenshot({ path: path.join(ROOT, '.tmp-test', 'round-home.png') });
  await page.evaluate(() => { const s = document.querySelector('.side'); if (s) s.classList.add('on'); });
  await sleep(600);
  await page.screenshot({ path: path.join(ROOT, '.tmp-test', 'round-drawer.png') });
  await page.evaluate(() => { const s = document.querySelector('.side'); if (s) s.classList.remove('on'); });
  await page.click('.tab[data-tab="search"]'); await sleep(700);
  await page.screenshot({ path: path.join(ROOT, '.tmp-test', 'round-search.png') });
  await page.click('.tab[data-tab="dm"]'); await sleep(900);
  await page.screenshot({ path: path.join(ROOT, '.tmp-test', 'round-dm.png') });
  console.log(JSON.stringify({ radii, errs }));
  await browser.close(); site.close();
})().catch((e) => { console.log('ERR ' + e); process.exit(2); });
