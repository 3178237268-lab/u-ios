const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(2200);
  await page.click('#guestBtn');
  await page.waitForTimeout(2000);
  await page.evaluate(() => document.querySelector('.tab[data-tab="notify"]').click());
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('#notifyList .notify-item'));
    return {
      titles: items.map(x => x.querySelector('h4') ? x.querySelector('h4').textContent : ''),
      times: items.map(x => x.querySelector('.nt') ? x.querySelector('.nt').textContent : ''),
      seeded: localStorage.getItem('u-notice-seeded'),
      ver: localStorage.getItem('u-app-ver')
    };
  });
  console.log(JSON.stringify(r, null, 2));
  await page.screenshot({ path: '.tmp-test/shots/v16-notify.png' });
  console.log('ERRORS', JSON.stringify(errs.slice(0, 5)));
  await browser.close();
})();
