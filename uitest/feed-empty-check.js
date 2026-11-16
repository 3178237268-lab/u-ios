const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/api/**', r => r.abort());
  await p.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(2200);
  await p.click('#guestBtn');
  await p.waitForTimeout(2000);
  const r = await p.evaluate(() => {
    const e = document.querySelector('#feedList .empty');
    return { html: e ? e.innerHTML.slice(0, 200) : 'none', hasP: e ? !!e.querySelector('p') : null };
  });
  console.log(JSON.stringify(r));
  await p.screenshot({ path: '.tmp-test/shots/feed-empty-light.png' });
  console.log('ERRORS', JSON.stringify(errs.slice(0, 5)));
  await b.close();
})();
