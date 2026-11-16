const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(2000);
  await p.click('#guestBtn');
  await p.waitForTimeout(1500);
  await p.evaluate(() => {
    document.querySelector('#sideBackdrop').classList.add('open');
    document.querySelector('#sideDrawer').classList.add('open');
  });
  await p.waitForTimeout(500);
  const items = await p.evaluate(() => [...document.querySelectorAll('.side-item')].map(b => b.dataset.side));
  console.log(JSON.stringify({ items, errs }));
  await b.close();
})();
