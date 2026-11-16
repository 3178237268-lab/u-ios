const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  for (const scheme of ['dark', 'light']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme });
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(2000);
    await p.click('#guestBtn');
    await p.waitForTimeout(1800);
    const st = await p.evaluate(() => ({
      auth: getComputedStyle(document.querySelector('#authScreen')).display,
      logo: document.querySelector('#logoBtn').getBoundingClientRect().toJSON()
    }));
    console.log(scheme, JSON.stringify(st));
    await p.screenshot({ path: `.tmp-test/shots/logo-app-${scheme}.png`, clip: { x: 0, y: 0, width: 390, height: 64 } });
    await ctx.close();
  }
  await b.close();
})();
