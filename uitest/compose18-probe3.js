
const { chromium } = require('playwright-core');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..'); const SITE = 18807;
const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const file = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p);
  fs.readFile(file, (e, buf) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(buf); });
}).listen(SITE);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  for (const vp of [{ width: 420, height: 900 }, { width: 1400, height: 900 }]) {
    const ctx = await b.newContext({ viewport: vp });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 120)));
    await page.goto('http://127.0.0.1:' + SITE + '/', { waitUntil: 'load' });
    await page.waitForTimeout(900);
    const gb = await page.$('#guestBtn'); if (gb) { await gb.click(); await page.waitForTimeout(1200); }
    await page.evaluate(() => { const btn = document.querySelector('#composeBtn'); if (btn) btn.click(); });
    await sleep(700);
    const md = 'D:\\deepseek\\gouzuoqu\\U\\11111\\data\\media';
    const small = fs.readdirSync(md).map(f => ({ f, s: fs.statSync(path.join(md, f)).size })).filter(o => o.s > 20000 && o.s < 60000).slice(0, 6);
    const files = small.map((o, i) => ({ name: 'p' + i + '.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(path.join(md, o.f)) }));
    console.log('ATTACH ' + files.length);
    if (files.length) { await page.setInputFiles('#filePicker', files).catch(e => console.log('setfail ' + e.message)); await sleep(3000); }
    const before = await page.evaluate(() => ({ grid: document.querySelectorAll('#mediaGrid > *').length, cnt: (document.querySelector('#mediaCount') || {}).textContent, composeH: Math.round(document.querySelector('#compose').getBoundingClientRect().height), bodyScrollH: (function(){ const s = document.querySelector('#compose .sheet-scroll, #compose .c-body, #compose .sheet-body'); return s ? s.scrollHeight + '/' + s.clientHeight : -1; })() }));
    console.log('VP ' + vp.width + ' BEFORE ' + JSON.stringify(before));
    await page.evaluate(() => { const l = document.querySelector('#sensRow'); l.scrollIntoView({ block: 'center' }); });
    await sleep(300);
    await page.evaluate(() => { document.querySelector('#sensRow').click(); });
    await sleep(600);
    const after = await page.evaluate(() => {
      const g = document.querySelector('#gameSheet');
      const rectAtBottom = document.elementFromPoint(Math.round(innerWidth / 2), innerHeight - 60);
      const chain = []; let n = rectAtBottom; while (n && chain.length < 6) { chain.push(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (typeof n.className === 'string' && n.className ? '.' + n.className.split(/\s+/)[0] : '')); n = n.parentElement; }
      return { game: g.className, vis: getComputedStyle(g).visibility, sensChecked: document.querySelector('#composeSensitive').checked, bottomEl: chain, scrollY: window.scrollY, docH: document.documentElement.scrollHeight };
    });
    console.log('VP ' + vp.width + ' AFTER ' + JSON.stringify(after) + ' errs=' + JSON.stringify(errs));
    await page.evaluate(() => { const s = document.querySelector('#compose .sheet-scroll, #compose .c-body, #compose .sheet-body'); if (s) s.scrollTop = s.scrollHeight; });
    await sleep(400);
    await page.screenshot({ path: path.join(__dirname, '..', '.tmp-test', 'compose18-' + vp.width + '.png') });
    await ctx.close();
  }
  await b.close(); site.close(); process.exit(0);
})().catch(e => { console.log('ERR ' + e); process.exit(2); });
