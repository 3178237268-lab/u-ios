const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  for (const scheme of ['dark', 'light']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(2000);
    await p.evaluate(() => document.querySelector('#guestBtn').click());
    await p.waitForTimeout(1800);
    const st = await p.evaluate(() => ({
      game: document.querySelector('#gameSheet') ? document.querySelector('#gameSheet').classList.contains('open') : null,
      auth: document.querySelector('#authScreen') ? getComputedStyle(document.querySelector('#authScreen')).display : null,
      logo: document.querySelector('#logoBtn').getBoundingClientRect().toJSON()
    }));
    console.log(scheme, JSON.stringify(st));
    await p.screenshot({ path: `.tmp-test/shots/logo-app-${scheme}.png`, clip: { x: 0, y: 0, width: 390, height: 64 } });
    console.log('ERRORS', scheme, JSON.stringify(errs.slice(0, 3)));
    await ctx.close();
  }
  await b.close();
})();
