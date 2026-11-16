const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  for (const scheme of ['dark', 'light']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1800);
    await p.click('#guestBtn');
    await p.waitForTimeout(1500);
    const m = await p.evaluate(() => {
      const on = document.querySelector('#homeTabs .feedtab.on');
      const cs = on ? getComputedStyle(on) : null;
      return on ? { text: on.textContent.trim(), radius: cs.borderRadius, bg: cs.backgroundColor, color: cs.color } : null;
    });
    console.log(scheme, JSON.stringify(m));
    await p.screenshot({ path: `.tmp-test/shots/hometabs-${scheme}.png`, clip: { x: 0, y: 40, width: 390, height: 180 } });
    console.log('ERRORS', scheme, JSON.stringify(errs.slice(0, 3)));
    await ctx.close();
  }
  await b.close();
})();
