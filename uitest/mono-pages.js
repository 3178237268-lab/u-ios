const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => localStorage.setItem('u-theme', 'dark'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1600);
  await page.click('#guestBtn');
  await page.waitForTimeout(2200);

  const shot = async (name) => { await page.waitForTimeout(450); await page.screenshot({ path: '.tmp-test/shots/' + name + '.png' }); };

  // 我的
  await page.evaluate(() => document.querySelector('.tab[data-tab="dm"]').click());
  await shot('mono-dark-dm');
  // 通知
  await page.evaluate(() => document.querySelector('.tab[data-tab="notify"]').click());
  await shot('mono-dark-notify');
  // 搜索
  await page.evaluate(() => document.querySelector('.tab[data-tab="search"]').click());
  await shot('mono-dark-search');
  // 发布
  await page.evaluate(() => document.querySelector('#composeBtn').click());
  await shot('mono-dark-compose');
  await page.evaluate(() => { const c = document.querySelector('#compose'); if (c) c.classList.remove('open'); document.body.classList.remove('compose-open'); });
  await page.waitForTimeout(400);
  // 侧边菜单
  await page.evaluate(() => { if (window.openSide) window.openSide(); else document.querySelector('#sideDrawer').classList.add('open'); });
  await shot('mono-dark-side');
  await page.evaluate(() => { const d = document.querySelector('#sideDrawer'); if (d) d.classList.remove('open'); const b = document.querySelector('#sideBackdrop'); if (b) b.classList.remove('on'); });
  // 帖子详情
  await page.evaluate(() => document.querySelector('.tab[data-tab="feed"]').click());
  await page.waitForTimeout(500);
  await page.evaluate(() => { const p = document.querySelector('#feedList .post'); if (p) p.click(); });
  await shot('mono-dark-detail');
  await page.evaluate(() => { if (window.closePost) window.closePost(); });

  // 浅色
  await page.evaluate(() => localStorage.setItem('u-theme', 'light'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1600);
  await page.evaluate(() => document.querySelector('#guestBtn') && document.querySelector('#guestBtn').click());
  await page.waitForTimeout(1800);
  await page.evaluate(() => document.querySelector('.tab[data-tab="notify"]').click());
  await shot('mono-light-notify');
  await page.evaluate(() => document.querySelector('#composeBtn').click());
  await shot('mono-light-compose');
  console.log('ERRORS', JSON.stringify(errs.slice(0, 8)));
  await browser.close();
})();
