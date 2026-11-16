const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' });
  await ctx.addInitScript(() => { try { localStorage.setItem('u-seeded', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(2200);
  await page.click('#guestBtn');
  await page.waitForTimeout(2200);
  const r = await page.evaluate(() => {
    const l = document.querySelector('#feedList');
    return {
      seeded: localStorage.getItem('u-seeded'),
      posts: l ? l.querySelectorAll('.post').length : -1,
      empty: l ? !!l.querySelector('.empty') : null
    };
  });
  console.log('EMPTY-DB GUEST', JSON.stringify(r));
  // 刷新后仍应存在
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2200);
  const r2 = await page.evaluate(() => {
    const l = document.querySelector('#feedList');
    return { posts: l ? l.querySelectorAll('.post').length : -1 };
  });
  console.log('AFTER RELOAD', JSON.stringify(r2));

  // 侧边栏与浅色登录页截图
  await page.evaluate(() => localStorage.setItem('u-theme', 'light'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '.tmp-test/shots/mono-auth-light2.png' });
  console.log('ERRORS', JSON.stringify(errs.slice(0, 5)));
  await browser.close();
})();
