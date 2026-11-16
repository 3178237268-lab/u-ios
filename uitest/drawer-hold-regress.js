const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: false, hasTouch: true, colorScheme: 'dark' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(2000);
  await p.click('#guestBtn');
  await p.waitForTimeout(1500);
  await p.mouse.move(30, 500);
  await p.mouse.down();
  for (let i = 1; i <= 10; i++) { await p.mouse.move(30 + i * 12, 500); await p.waitForTimeout(16); }
  await p.mouse.up();
  await p.waitForTimeout(600);
  const opened = await p.evaluate(() => document.querySelector('#sideDrawer').classList.contains('open'));
  const box = await p.locator('.side-item[data-side="favorites"]').boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await p.waitForTimeout(1100);
  const during = await p.evaluate(() => ({ sel: String(window.getSelection()), sheet: document.querySelector('#sideListSheet').classList.contains('open') }));
  await p.mouse.up();
  await p.waitForTimeout(300);
  const afterHold = await p.evaluate(() => ({ sheet: document.querySelector('#sideListSheet').classList.contains('open'), drawer: document.querySelector('#sideDrawer').classList.contains('open') }));
  console.log(JSON.stringify({ opened, during, afterHold, errs: errs.slice(0, 3) }));
  await ctx.close();
  await b.close();
})();
