const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1800);
  await page.evaluate(() => localStorage.setItem('u-theme', 'light'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.click('#guestBtn');
  await page.waitForTimeout(1800);
  const r = await page.evaluate(() => {
    const tb = document.querySelector('.topbar');
    const av = document.querySelector('#sideAvatar') || document.querySelector('.topbar .avatar');
    const right = document.querySelector('.topbar .right');
    const logo = document.querySelector('#logoBtn');
    const box = (el) => el ? { rect: el.getBoundingClientRect().toJSON(), display: getComputedStyle(el).display, opacity: getComputedStyle(el).opacity, vis: getComputedStyle(el).visibility, cls: el.className } : null;
    return {
      scrollY: window.scrollY,
      appScroll: document.querySelector('.app').scrollTop,
      bodyScroll: document.body.scrollTop,
      vh: getComputedStyle(document.documentElement).getPropertyValue('--vh'),
      topbar: box(tb), avatar: box(av), right: box(right), logo: box(logo)
    };
  });
  console.log(JSON.stringify(r, null, 2));
  await browser.close();
})();
