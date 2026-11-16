
const { chromium } = require('playwright-core');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  await page.goto('http://127.0.0.1:8765/', { waitUntil: 'load', timeout: 40000 });
  await page.evaluate(() => localStorage.setItem('u-theme', 'light'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2200);
  if (await page.$('#guestBtn')) { await page.click('#guestBtn').catch(() => {}); await page.waitForTimeout(2500); }
  await page.waitForTimeout(2500);
  const click = await page.evaluate(() => { const b = document.querySelector('#feedList .pactions .like'); if (!b) return 'none'; if (!b.classList.contains('on')) b.click(); const r = b.getBoundingClientRect(); return { on: true, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; });
  await page.waitForTimeout(1500);
  const shot = await page.evaluate(() => { const p = document.querySelector('#feedList .post'); const r = p.getBoundingClientRect(); return { y: Math.round(r.y), h: Math.round(r.height) }; });
  await page.screenshot({ path: path.join(ROOT, 'uitest', 'like-light-after.png'), clip: { x: 0, y: Math.max(0, shot.y), width: 420, height: Math.min(300, shot.h) } });
  console.log('SHOT ' + JSON.stringify(shot) + ' CLICK ' + JSON.stringify(click));
  await browser.close(); process.exit(0);
})().catch((e) => { console.log('ERR ' + e.stack); process.exit(1); });