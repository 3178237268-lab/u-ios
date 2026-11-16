const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const ROOT = 'D:/deepseek/gouzuoqu/U';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 18856;
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  const ext = path.extname(f);
  res.writeHead(200, { 'Content-Type': ext === '.html' ? 'text/html; charset=utf-8' : ext === '.js' ? 'text/javascript' : 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise(r => server.listen(PORT, r));
  const b = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox','--disable-gpu'] });
  const page = await (await b.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:' + PORT + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.setItem('u-server', 'http://127.0.0.1:8787'); localStorage.setItem('u-theme', 'dark'); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.click('#guestBtn').catch(() => {});
  await page.waitForTimeout(3500);
  // reveal 18+ locks
  for (let i = 0; i < 6; i++) {
    const btns = await page.$$('.plock button, .psensitive button, [data-reveal]');
    if (!btns.length) break;
    for (const bt of btns) { await bt.click({ force: true }).catch(() => {}); }
    await page.waitForTimeout(400);
  }
  const shown = await page.evaluate(() => document.querySelectorAll('.plock, .psensitive').length);
  // scroll to a post holding the HEVC video
  const target = await page.evaluate(() => {
    const v = document.querySelector('video[data-mid="srvm_ac987b17257960abcf6d3331"]');
    if (!v) return 'notfound';
    v.scrollIntoView({ block: 'center' });
    return 'scrolled';
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(ROOT, 'uitest/cover45b.png') });
  const detail = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.pmedia .vplayer.vgrid'));
    const v = document.querySelector('video[data-mid="srvm_ac987b17257960abcf6d3331"]');
    const card = v && v.closest('.vplayer');
    return { cards: cards.length, hevcBg: card ? getComputedStyle(card).backgroundImage.slice(0, 42) : '', hevcPoster: v ? v.getAttribute('poster') : 'x', vpClass: card ? card.className : '' };
  });
  console.log(JSON.stringify({ errs, shown, target, detail }, null, 1));
  await b.close(); server.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
