const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(2000);
  await p.click('#guestBtn');
  await p.waitForTimeout(1800);
  await p.evaluate(() => document.querySelector('.tab[data-tab="notify"]').click());
  await p.waitForTimeout(700);
  const r = await p.evaluate(() => Array.from(document.querySelectorAll('#notifyList .notify-item')).map(x => ({
    t: x.querySelector('h4').textContent.trim(),
    bodyHead: x.querySelector('p').textContent.trim().slice(0, 24)
  })));
  console.log(JSON.stringify(r, null, 1));
  await p.screenshot({ path: '.tmp-test/shots/notify-sorted.png', fullPage: false });
  console.log('ERRORS', JSON.stringify(errs.slice(0, 5)));
  await b.close();
})();
