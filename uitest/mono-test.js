const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const errs = [];

  async function newPage(url) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(2200);
    return page;
  }

  // 1) 本地游客
  const p1 = await newPage('http://127.0.0.1:8765/index.html');
  await p1.screenshot({ path: '.tmp-test/shots/mono-auth-dark.png' });
  await p1.click('#guestBtn');
  await p1.waitForTimeout(2200);
  const r1 = await p1.evaluate(() => {
    const list = document.querySelector('#feedList');
    const fab = document.querySelector('#fab');
    const cs = getComputedStyle(document.body);
    return {
      bodyBg: cs.backgroundColor,
      text: cs.color,
      accent: cs.getPropertyValue('--accent').trim(),
      feedPosts: list ? list.querySelectorAll('.post').length : -1,
      feedEmpty: list ? !!list.querySelector('.empty') : null,
      views: list ? Array.from(list.querySelectorAll('[data-act="views"] span')).slice(0, 4).map(x => x.textContent) : [],
      fabBg: fab ? getComputedStyle(fab).backgroundImage.slice(0, 60) : null
    };
  });
  console.log('LOCAL GUEST', JSON.stringify(r1));
  await p1.screenshot({ path: '.tmp-test/shots/mono-feed-dark.png' });
  await p1.evaluate(() => { document.body.classList.add('light'); });
  await p1.waitForTimeout(400);
  await p1.screenshot({ path: '.tmp-test/shots/mono-feed-light.png' });
  await p1.evaluate(() => { if (window.switchTab) window.switchTab('profile'); });
  await p1.waitForTimeout(600);
  await p1.screenshot({ path: '.tmp-test/shots/mono-profile-light.png' });

  // 2) 服务器游客（真实计数）
  const p2 = await newPage('http://127.0.0.1:8765/index.html?srv=http://127.0.0.1:8790');
  await p2.waitForTimeout(1200);
  await p2.click('#guestBtn');
  await p2.waitForTimeout(3000);
  const r2 = await p2.evaluate(() => {
    const list = document.querySelector('#feedList');
    return {
      srv: localStorage.getItem('u-server'),
      posts: list ? list.querySelectorAll('.post').length : -1,
      texts: list ? Array.from(list.querySelectorAll('.ptext')).slice(0, 3).map(x => x.textContent.slice(0, 20)) : [],
      views: list ? Array.from(list.querySelectorAll('[data-act="views"] span')).map(x => x.textContent) : []
    };
  });
  console.log('SERVER GUEST', JSON.stringify(r2));
  await p2.screenshot({ path: '.tmp-test/shots/mono-srv-feed.png' });

  console.log('ERRORS', JSON.stringify(errs.slice(0, 8)));
  await browser.close();
})();
