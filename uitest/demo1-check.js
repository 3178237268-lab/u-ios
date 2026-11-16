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
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => {
    const l = document.querySelector('#feedList');
    return {
      posts: l ? l.querySelectorAll('.post').length : -1,
      ids: l ? Array.from(l.querySelectorAll('.post')).map(x => x.getAttribute('data-id')) : [],
      texts: l ? Array.from(l.querySelectorAll('.ptext')).map(x => x.textContent.slice(0, 12)) : [],
      hasOld: l ? l.innerText.includes('U 1.4 来了') : null
    };
  });
  console.log('FEED', JSON.stringify(r));
  await page.screenshot({ path: '.tmp-test/shots/feed-no-demo1.png' });
  console.log('ERRORS', JSON.stringify(errs.slice(0, 5)));
  await browser.close();
})();
