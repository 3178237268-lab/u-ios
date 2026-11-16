
const { chromium } = require('playwright-core');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..'); const SITE = 18809;
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
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 150)));
  await page.goto('http://127.0.0.1:' + SITE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(900);
  const gb = await page.$('#guestBtn'); if (gb) { await gb.click(); await page.waitForTimeout(1200); }
  await page.evaluate(() => document.querySelector('#composeBtn').click());
  await sleep(700);
  const md = 'D:\\deepseek\\gouzuoqu\\U\\11111\\data\\media';
  const small = fs.readdirSync(md).map(f => ({ f, s: fs.statSync(path.join(md, f)).size })).filter(o => o.s > 20000 && o.s < 60000).slice(0, 6);
  await page.setInputFiles('#filePicker', small.map((o, i) => ({ name: 'p' + i + '.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(path.join(md, o.f)) })));
  await sleep(2600);
  await page.evaluate(() => document.querySelector('#sensRow').scrollIntoView({ block: 'center' }));
  await sleep(300);
  await page.evaluate(() => document.querySelector('#sensRow').click());
  await sleep(500);
  await page.evaluate(() => { const s = document.querySelector('#compose .sheet-scroll, #compose .c-body, #compose .sheet-body'); if (s) s.scrollTop = s.scrollHeight; });
  await sleep(300);
  const leak = await page.evaluate(() => { const el = document.elementFromPoint(210, 880); const chain = []; let n = el; while (n && chain.length < 5) { chain.push(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '')); n = n.parentElement; } return chain; });
  await page.screenshot({ path: path.join(__dirname, '..', '.tmp-test', 'compose18-fixed.png') });
  console.log('BOTTOM ' + JSON.stringify(leak));
  // close compose, open drawer -> game
  await page.evaluate(() => document.querySelector('#composeClose').click());
  await sleep(500);
  await page.evaluate(() => { const d = document.querySelector('#sideDrawer'); if (d) d.classList.add('open'); const bd = document.querySelector('#sideBackdrop'); if (bd) bd.classList.add('open'); });
  await sleep(400);
  await page.evaluate(() => { const it = document.querySelector('[data-side="game"]'); if (it) it.click(); });
  await sleep(2500);
  const game = await page.evaluate(() => {
    const s = document.querySelector('#gameSheet'); const st = document.querySelector('#shStart'); const r = st.getBoundingClientRect();
    return { cls: s.className, vis: getComputedStyle(s).visibility, startVis: getComputedStyle(st).visibility, startTop: Math.round(r.top), startH: Math.round(r.height), cardVisible: !!document.querySelector('.sh-card') };
  });
  console.log('GAME ' + JSON.stringify(game) + ' errs=' + JSON.stringify(errs));
  await page.screenshot({ path: path.join(__dirname, '..', '.tmp-test', 'game-after-fix.png') });
  await b.close(); site.close(); process.exit(0);
})().catch(e => { console.log('ERR ' + e); process.exit(2); });
