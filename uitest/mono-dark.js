const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('response', r => { if (r.status() >= 400) errs.push('HTTP ' + r.status() + ' ' + r.url()); });
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(2200);
  await page.evaluate(() => { localStorage.setItem('u-theme', 'dark'); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1800);
  const boot = await page.evaluate(() => ({
    light: document.body.classList.contains('light'),
    bg: getComputedStyle(document.body).backgroundColor,
    theme: localStorage.getItem('u-theme')
  }));
  console.log('DARK BOOT', JSON.stringify(boot));
  await page.screenshot({ path: '.tmp-test/shots/mono-auth-dark2.png' });
  await page.click('#guestBtn');
  await page.waitForTimeout(2200);
  const r = await page.evaluate(() => {
    const list = document.querySelector('#feedList');
    const tabOn = document.querySelector('#homeTabs .feedtab.on');
    const fab = document.querySelector('.fab');
    return {
      light: document.body.classList.contains('light'),
      posts: list ? list.querySelectorAll('.post').length : -1,
      tabOnBg: tabOn ? getComputedStyle(tabOn).backgroundColor : null,
      tabOnColor: tabOn ? getComputedStyle(tabOn).color : null,
      fabBg: fab ? getComputedStyle(fab).backgroundImage.slice(0, 90) : null,
      fabColor: fab ? getComputedStyle(fab).color : null,
      postBg: list && list.querySelector('.post') ? getComputedStyle(list.querySelector('.post')).backgroundColor : null
    };
  });
  console.log('DARK FEED', JSON.stringify(r));
  await page.screenshot({ path: '.tmp-test/shots/mono-feed-dark2.png' });
  await page.evaluate(() => { document.querySelector('[data-tab="profile"]')?.click(); });
  await page.waitForTimeout(800);
  await page.screenshot({ path: '.tmp-test/shots/mono-profile-dark2.png' });
  console.log('ERRORS', JSON.stringify(errs.slice(0, 10)));
  await browser.close();
})();
