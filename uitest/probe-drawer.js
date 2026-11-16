
const { chromium } = require('playwright-core');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const SITE = 18797;
const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const file = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p);
  fs.readFile(file, (e, buf) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(buf); });
}).listen(SITE);
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, hasTouch: true })).newPage();
  await page.goto('http://127.0.0.1:' + SITE + '/', { waitUntil: 'load', timeout: 40000 });
  await new Promise(r => setTimeout(r, 800));
  const out = await page.evaluate(() => ({
    drawer: !!document.querySelector('#sideDrawer'),
    anySideDrawer: document.querySelectorAll('.side-drawer').length,
    backdrop: !!document.querySelector('#sideBackdrop'),
    tabs: document.querySelectorAll('.tab').length,
    ids: Array.prototype.slice.call(document.querySelectorAll('[id]')).map(e => e.id).filter(i => /drawer|side/i.test(i))
  }));
  console.log(JSON.stringify(out));
  await browser.close(); site.close(); process.exit(0);
})().catch(e => { console.log('ERR ' + e); process.exit(2); });
