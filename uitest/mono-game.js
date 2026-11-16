const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 120)); });
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => localStorage.setItem('u-theme', 'dark'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1800);
  await page.click('#guestBtn');
  await page.waitForTimeout(2000);
  const opened = await page.evaluate(() => {
    const d = document.querySelector('#sideDrawer');
    if (d) d.classList.add('open');
    const item = document.querySelector('[data-side="game"]');
    if (item) { item.click(); return true; }
    return false;
  });
  await page.waitForTimeout(5000);
  const state = await page.evaluate(() => {
    const s = document.querySelector('#gameSheet');
    const c = document.querySelector('#shCanvas');
    return {
      sheetOpen: s ? s.classList.contains('open') : false,
      canvas: c ? { w: c.width, h: c.height } : null,
      stageTop: document.querySelector('#shStage') ? document.querySelector('#shStage').getBoundingClientRect().top : null
    };
  });
  console.log('GAME', JSON.stringify(state));
  await page.screenshot({ path: '.tmp-test/shots/mono-game.png' });
  console.log('ERRORS', JSON.stringify(errs.slice(0, 6)));
  await browser.close();
})();
