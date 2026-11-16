
const { chromium } = require('playwright-core');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const SITE = 18837, PAGE = 'http://127.0.0.1:' + SITE + '/';
const site = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split('?')[0]); const f = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p); fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(b); }); }).listen(SITE);
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 } })).newPage();
  await page.goto(PAGE, { waitUntil: 'load', timeout: 40000 });
  await page.waitForTimeout(1000);
  const res = await page.evaluate(() => {
    document.body.classList.remove('light');
    const out = [];
    for (const sh of document.styleSheets) {
      let rules; try { rules = sh.cssRules; } catch (e) { continue; }
      for (const r of rules) {
        const t = r.cssText || '';
        if (/\.like/.test(t) && /color|fill/.test(t)) out.push(t.slice(0, 220));
      }
    }
    const host = document.createElement('div'); host.className = 'pactions'; host.id = 'c41';
    host.innerHTML = '<button class="like on">a</button>';
    document.body.appendChild(host);
    const b = host.querySelector('.like.on');
    return { rules: out, color: getComputedStyle(b).color, bodyCls: document.body.className, rootPink: getComputedStyle(document.documentElement).getPropertyValue('--pink'), rootAccent: getComputedStyle(document.documentElement).getPropertyValue('--accent'), bodyAccent: getComputedStyle(document.body).getPropertyValue('--accent') };
  });
  console.log(JSON.stringify(res, null, 1).slice(0, 3000));
  await browser.close(); site.close(); process.exit(0);
})().catch((e) => { console.log('ERR ' + e.stack); process.exit(1); });