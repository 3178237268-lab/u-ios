const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => localStorage.setItem('u-theme', 'light'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1600);
  await page.click('#guestBtn');
  await page.waitForTimeout(2000);
  await page.evaluate(() => document.querySelector('.tab[data-tab="notify"]').click());
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    const tabs = document.querySelector('#notifyTabs');
    const on = document.querySelector('#notifyTabs .ntab.on');
    const svg = document.querySelector('#notifyBox svg');
    return {
      hasSub: !!document.querySelector('#viewNotify .sub'),
      emptyText: document.querySelector('#notifyBox .empty') ? document.querySelector('#notifyBox .empty').innerText : null,
      tabsRadius: getComputedStyle(tabs).borderRadius,
      onRadius: getComputedStyle(on).borderRadius,
      icon: svg ? { w: getComputedStyle(svg).width, h: getComputedStyle(svg).height } : null
    };
  });
  console.log('NOTIFY', JSON.stringify(r));
  await page.screenshot({ path: '.tmp-test/shots/notify-light-new.png' });
  await page.evaluate(() => document.querySelector('.tab[data-tab="feed"]').click());
  await page.waitForTimeout(500);
  const h = await page.evaluate(() => {
    const t = document.querySelector('.glass-tabs');
    return { radius: getComputedStyle(t).borderRadius, tab: getComputedStyle(t.querySelector('.feedtab')).borderRadius };
  });
  console.log('HOME TABS', JSON.stringify(h));
  await page.screenshot({ path: '.tmp-test/shots/home-light-new.png' });
  console.log('ERRORS', JSON.stringify(errs.slice(0, 5)));
  await browser.close();
})();
