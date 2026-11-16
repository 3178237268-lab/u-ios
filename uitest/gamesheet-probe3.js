
const { chromium } = require('playwright-core');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..'); const SITE = 18803;
const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const file = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p);
  fs.readFile(file, (e, buf) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(buf); });
}).listen(SITE);
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  await page.goto('http://127.0.0.1:' + SITE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const info = await page.evaluate(() => {
    const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return { top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height), pos: s.position, vis: s.visibility, dis: s.display, ovf: s.overflow, z: s.zIndex, tr: s.transform }; };
    return {
      app: box(document.querySelector('#app')),
      appStyle: (function(){ const a = document.querySelector('#app'); const s = getComputedStyle(a); return { maxWidth: s.maxWidth, margin: s.margin, height: s.height, minHeight: s.minHeight }; })(),
      game: box(document.querySelector('#gameSheet')),
      compose: box(document.querySelector('#compose')),
      card: box(document.querySelector('.sh-card')),
      docH: document.documentElement.scrollHeight, bodyH: document.body.scrollHeight,
    };
  });
  console.log(JSON.stringify(info, null, 1));
  await b.close(); site.close(); process.exit(0);
})().catch(e => { console.log('ERR ' + e); process.exit(2); });