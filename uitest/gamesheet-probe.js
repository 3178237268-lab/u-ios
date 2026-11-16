
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
    function chain(el) { const out = []; let n = el; while (n && n.tagName && out.length < 8) { out.push((n.tagName.toLowerCase()) + (n.id ? '#' + n.id : '') + (n.className && typeof n.className === 'string' ? '.' + n.className.split(/\s+/).slice(0,3).join('.') : '')); n = n.parentElement; } return out; }
    const g = document.querySelector('#gameSheet');
    const cs = g ? getComputedStyle(g) : null;
    const rect = g ? g.getBoundingClientRect() : null;
    const lobby = document.querySelector('#shLobby') || document.querySelector('.sh-lobby');
    const lcs = lobby ? getComputedStyle(lobby) : null;
    return {
      hasGame: !!g,
      gameChain: g ? chain(g) : null,
      gameStyle: cs ? { display: cs.display, position: cs.position, zIndex: cs.zIndex, visibility: cs.visibility, opacity: cs.opacity, inset: cs.inset, transform: cs.transform } : null,
      gameRect: rect ? { top: Math.round(rect.top), h: Math.round(rect.height), w: Math.round(rect.width) } : null,
      lobby: lobby ? { id: lobby.id, cls: String(lobby.className), display: lcs.display, position: lcs.position, top: Math.round(lobby.getBoundingClientRect().top) } : null,
      sheets: Array.prototype.slice.call(document.querySelectorAll('section.sheet')).map(function (s) { return s.id + ':' + getComputedStyle(s).display + '/' + getComputedStyle(s).zIndex; }),
    };
  });
  console.log(JSON.stringify(info, null, 1));
  await b.close(); site.close(); process.exit(0);
})().catch(e => { console.log('ERR ' + e); process.exit(2); });
