
const { chromium } = require('playwright-core');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  await page.goto('http://127.0.0.1:8765/', { waitUntil: 'load', timeout: 40000 });
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2000);
  if (await page.$('#guestBtn')) { await page.click('#guestBtn').catch(() => {}); await page.waitForTimeout(3500); }
  await page.waitForTimeout(4000);
  const st = await page.evaluate(() => { const b = document.querySelector('#ntTabBadge'); if (!b) return null; const cs = getComputedStyle(b); const r = b.getBoundingClientRect(); return { text: b.textContent, on: b.classList.contains('on'), display: cs.display, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }, msgs: (JSON.parse(localStorage.getItem('u-msgs') || '[]')).filter((m) => m.type !== 'dm' && !m.read).length }; });
  console.log('LIVE ' + JSON.stringify(st));
  await page.screenshot({ path: path.join(ROOT, 'uitest', 'ntbadge-live.png'), clip: { x: 0, y: 770, width: 420, height: 130 } });
  await browser.close(); process.exit(0);
})().catch((e) => { console.log('ERR ' + e.stack); process.exit(1); });