const { chromium } = require('playwright-core');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..'); const SITE = 18842;
const site = http.createServer((q, s) => { const p = decodeURIComponent(q.url.split('?')[0]); const f = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p); fs.readFile(f, (e, b) => { if (e) { s.writeHead(404); s.end(); return; } const ext = path.extname(f); s.writeHead(200, { 'content-type': ext === '.html' ? 'text/html; charset=utf-8' : ext === '.js' ? 'application/javascript' : 'application/octet-stream' }); s.end(b); }); }).listen(SITE);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await b.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  await page.goto('http://127.0.0.1:' + SITE + '/', { waitUntil: 'load' });
  await sleep(2200);
  if (await page.$('#guestBtn')) { await page.click('#guestBtn').catch(() => {}); await sleep(1500); }
  await page.evaluate(() => { window.openJumpGame(); });
  for (let i = 0; i < 40; i++) { const s = await page.evaluate(() => window.jumpGameState()); if (s.built) break; await sleep(400); }
  await sleep(400);
  await page.click('#jumpStartBtn');
  await sleep(700);
  await page.screenshot({ path: path.join(ROOT, 'uitest', 'jump-framing.png') });
  async function jumpTo(t) { await page.mouse.move(210, 620); await page.mouse.down(); for (let i = 0; i < 260; i++) { const s = await page.evaluate(() => window.jumpGameState()); if (s.phase !== 'charge' || s.power >= t - 0.012) break; await sleep(12); } await page.mouse.up(); for (let i = 0; i < 100; i++) { const s = await page.evaluate(() => window.jumpGameState()); if (s.phase !== 'jump') break; await sleep(35); } return page.evaluate(() => window.jumpGameState()); }
  for (let i = 0; i < 4; i++) { const s = await page.evaluate(() => window.jumpGameState()); const t = Math.max(0.02, Math.min(0.98, (s.gap - 1.7) / 5.6)); const r = await jumpTo(t); console.log('jump ' + i + ' score=' + r.score + ' gap=' + s.gap.toFixed(2)); }
  await sleep(400);
  await page.screenshot({ path: path.join(ROOT, 'uitest', 'jump-framing2.png') });
  console.log('OK ' + JSON.stringify(await page.evaluate(() => window.jumpGameState())));
  await b.close(); site.close(); process.exit(0);
})().catch((e) => { console.log('ERR ' + e.stack); process.exit(1); });