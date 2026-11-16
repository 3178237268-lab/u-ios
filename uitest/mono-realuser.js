const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));

  const url = 'http://127.0.0.1:8765/index.html?srv=http://127.0.0.1:8790';
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => localStorage.setItem('u-theme', 'dark'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1600);

  const name = 'real' + String(Date.now()).slice(-6);
  await page.click('[data-auth-tab="register"]');
  await page.fill('#authUser', name);
  await page.fill('#authPass', 'pass1234');
  await page.fill('#authNick', '真实' + name.slice(-3));
  await page.click('#authSubmit');
  await page.waitForTimeout(3000);

  const feed = await page.evaluate(() => {
    const l = document.querySelector('#feedList');
    return { posts: l ? l.querySelectorAll('.post').length : -1, views: l ? Array.from(l.querySelectorAll('[data-act="views"] span')).map(x => x.textContent) : [] };
  });
  console.log('FEED', JSON.stringify(feed));

  // 打开我的主页
  await page.evaluate(() => { const d = document.querySelector('#sideDrawer'); if (d) d.classList.add('open'); });
  await page.waitForTimeout(300);
  await page.click('#sideAvatar');
  await page.waitForTimeout(900);
  const stats = await page.evaluate(() => {
    const st = document.querySelectorAll('#profileContent .pstats b');
    return { stats: Array.from(st).map(x => x.textContent), counts: window.__nope };
  });
  console.log('PROFILE STATS', JSON.stringify(stats));
  await page.screenshot({ path: '.tmp-test/shots/mono-profile-real-dark.png' });

  // 粉丝列表
  await page.evaluate(() => document.querySelector('#profileContent [data-followlist="fans"]')?.click());
  await page.waitForTimeout(1200);
  const fans = await page.evaluate(() => {
    const box = document.querySelector('#followList');
    return { rows: box ? box.querySelectorAll('.frow').length : -1, names: box ? Array.from(box.querySelectorAll('.fname')).map(x => x.textContent) : [] };
  });
  console.log('FANS LIST', JSON.stringify(fans));
  await page.screenshot({ path: '.tmp-test/shots/mono-fans-dark.png' });

  // 浅色主页
  await page.evaluate(() => { const b = document.querySelector('#followSheet'); if (b) b.classList.remove('open'); document.body.classList.add('light'); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '.tmp-test/shots/mono-profile-real-light.png' });
  console.log('ERRORS', JSON.stringify(errs.slice(0, 6)));
  await browser.close();
})();
