
const { chromium } = require('playwright-core');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8765/', { waitUntil: 'load', timeout: 40000 });
  await page.waitForTimeout(2000);
  if (await page.$('#guestBtn')) { await page.click('#guestBtn').catch(() => {}); await page.waitForTimeout(3500); }
  await page.waitForTimeout(3000);
  const info = await page.evaluate(() => {
    const pick = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { text: el.textContent.trim(), on: el.classList.contains('on'), display: cs.display, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    return { bell: pick('#ntTabBadge'), dmTab: pick('#dmTabBadge'), dmDot: pick('#dmDot'), msgDot: pick('#msgDot'), offDot: pick('#offDot'), light: document.body.classList.contains('light'), tabbar: (() => { const r = document.querySelector('.tabbar').getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })() };
  });
  console.log('BADGES ' + JSON.stringify(info));
  await page.screenshot({ path: path.join(ROOT, 'uitest', 'badge-live.png'), clip: { x: 0, y: 800, width: 420, height: 100 } });
  await browser.close(); process.exit(0);
})().catch((e) => { console.log('ERR ' + e.stack); process.exit(1); });