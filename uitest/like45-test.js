
const { chromium } = require('playwright-core');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const SITE = 18836, PAGE = 'http://127.0.0.1:' + SITE + '/';
const site = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split('?')[0]); const f = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p); fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(b); }); }).listen(SITE);
let pass = 0, fail = 0;
function ok(c, n, x) { if (c) pass++; else { fail++; console.log('FAIL ' + n + ' :: ' + JSON.stringify(x)); } }
const rgb = (s) => (String(s).match(/\d+/g) || []).map(Number);
const HEART = '<path d="M12 20.3c-1.1-.9-6.9-5.3-8.5-8.1a4.9 4.9 0 0 1 1.8-6.7 4.9 4.9 0 0 1 6.7 1.8 4.9 4.9 0 0 1 6.7-1.8 4.9 4.9 0 0 1 1.8 6.7c-1.6 2.8-7.4 7.2-8.5 8.1z"/>';
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.goto(PAGE, { waitUntil: 'load', timeout: 40000 });
  await page.waitForTimeout(1200);
  await page.addStyleTag({ content: '*{transition:none!important;animation:none!important}' });
  const probe = async (theme) => page.evaluate(({ theme, HEART }) => {
    document.body.classList.toggle('light', theme === 'light');
    let host = document.getElementById('probe41');
    if (!host) {
      host = document.createElement('div'); host.id = 'probe41';
      host.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;padding:10px;background:var(--surface)';
      const svg = '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 20.3c-1.1-.9-6.9-5.3-8.5-8.1a4.9 4.9 0 0 1 1.8-6.7 4.9 4.9 0 0 1 6.7 1.8 4.9 4.9 0 0 1 6.7-1.8 4.9 4.9 0 0 1 1.8 6.7c-1.6 2.8-7.4 7.2-8.5 8.1z"/></svg>';
      host.innerHTML = '<div class="pactions">' +
        '<button class="like on" data-act="like">' + svg.replace('<path', '<path fill="currentColor"') + '<span>3</span></button>' +
        '<button class="repost" data-act="repost">' + svg + '<span>0</span></button>' +
        '<button class="like" data-act="like2">' + svg + '<span>0</span></button>' +
        '</div>';
      document.body.appendChild(host);
    }
    const on = host.querySelector('.like.on');
    const off = host.querySelector('.like:not(.on)');
    const svgPath = on.querySelector('svg path');
    return {
      light: document.body.classList.contains('light'),
      onColor: getComputedStyle(on).color,
      onSpan: getComputedStyle(on.querySelector('span')).color,
      onFill: getComputedStyle(svgPath).fill,
      offColor: getComputedStyle(off).color,
      onFont: getComputedStyle(on).fontSize
    };
  }, { theme, HEART });
  const L = await probe('light');
  const D = await probe('dark');
  const c = rgb(L.onColor);
  ok(L.light === true, 'light theme applied', L.light);
  ok(c[0] > 180 && c[1] < 130, 'light: liked heart is red', L.onColor);
  ok(rgb(L.onSpan)[0] > 180, 'light: liked count text also red', L.onSpan);
  ok(rgb(L.onFill)[0] > 180, 'light: heart fill follows currentColor', L.onFill);
  ok(rgb(L.offColor)[0] < 180, 'light: un-liked heart stays muted', L.offColor);
  const lum = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  ok(lum > 90, 'light: liked heart not dark', Math.round(lum));
  ok(rgb(D.onColor)[0] > 200 && rgb(D.onColor)[1] > 200, 'dark theme unchanged (whitish accent)', D.onColor);
  ok(D.onColor !== L.onColor, 'light and dark now differ', [L.onColor, D.onColor]);
  ok(errs.length === 0, 'no pageerror', errs.slice(0, 3));
  await page.screenshot({ path: path.join(ROOT, 'uitest', 'like41.png'), clip: { x: 0, y: 0, width: 420, height: 90 } }).catch(() => {});
  console.log('LIGHT ' + JSON.stringify(L)); console.log('DARK ' + JSON.stringify(D));
  console.log('RESULT ' + pass + '/' + (pass + fail));
  await browser.close(); site.close(); process.exit(0);
})().catch((e) => { console.log('ERR ' + e.stack); process.exit(1); });