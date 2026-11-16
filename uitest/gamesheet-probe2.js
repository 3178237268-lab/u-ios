
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
  const page = await (await b.newContext({ viewport: { width: 420, height: 900 } })).newPage();
  await page.goto('http://127.0.0.1:' + SITE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const info = await page.evaluate(() => {
    function chain(el) { const out = []; let n = el; while (n && n.tagName && out.length < 10) { out.push(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (typeof n.className === 'string' && n.className ? '.' + n.className.split(/\s+/).slice(0,3).join('.') : '')); n = n.parentElement; } return out; }
    const g = document.querySelector('#gameSheet');
    const lob = document.querySelector('.sh-lobby');
    return { gameChain: g ? chain(g) : null, lobbyChain: lob ? chain(lob) : null, lobbyStyle: lob ? { pos: getComputedStyle(lob).position, disp: getComputedStyle(lob).display, vis: getComputedStyle(lob.parentElement).visibility, zi: getComputedStyle(lob.parentElement).zIndex } : null };
  });
  console.log(JSON.stringify(info, null, 1));
  await b.close(); site.close(); process.exit(0);
})().catch(e => { console.log('ERR ' + e); process.exit(2); });