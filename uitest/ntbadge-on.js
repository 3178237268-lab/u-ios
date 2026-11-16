
const { chromium } = require('playwright-core');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8765/', { waitUntil: 'load', timeout: 40000 });
  await page.waitForTimeout(1500);
  if (await page.$('#guestBtn')) { await page.click('#guestBtn').catch(() => {}); await page.waitForTimeout(3000); }
  await page.evaluate(() => {
    const now = Date.now();
    const msgs = [1,2,3].map((i) => ({ id: 'shot' + i, type: i === 3 ? 'follow' : 'like', user: { name: '阿柚' + i, handle: 'bot_0' + i, key: 'bot_0' + i }, postId: 'p1', createdAt: now - i * 60000, read: false }));
    localStorage.setItem('u-msgs', JSON.stringify(msgs));
    localStorage.setItem('u-theme', 'light');
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const st = await page.evaluate(() => { const b = document.querySelector('#ntTabBadge'); const cs = getComputedStyle(b); const r = b.getBoundingClientRect(); return { text: b.textContent, on: b.classList.contains('on'), display: cs.display, bg: cs.backgroundColor, color: cs.color, fontSize: cs.fontSize, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }; });
  console.log('BADGE ' + JSON.stringify(st));
  await page.screenshot({ path: path.join(ROOT, 'uitest', 'ntbadge-on.png'), clip: { x: 200, y: 810, width: 220, height: 90 } });
  await browser.close(); process.exit(0);
})().catch((e) => { console.log('ERR ' + e.stack); process.exit(1); });