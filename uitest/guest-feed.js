const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const boot = await page.evaluate(() => ({
    auth: document.querySelector('#authScreen') ? document.querySelector('#authScreen').className : null,
    seeded: localStorage.getItem('u-seeded'),
    posts: (window.__state && window.__state.posts || []).length
  }));
  console.log('BOOT', JSON.stringify(boot));
  await page.click('#guestBtn');
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => {
    const list = document.querySelector('#feedList');
    return {
      tab: document.querySelector('.view.on') ? document.querySelector('.view.on').id : null,
      feedHTMLlen: list ? list.innerHTML.length : -1,
      feedText: list ? list.innerText.slice(0, 200) : '',
      empty: list ? !!list.querySelector('.empty') : null,
      tabTexts: Array.from(document.querySelectorAll('#homeTabs [data-home]')).map(b => b.textContent + '|' + b.className)
    };
  });
  console.log('AFTER GUEST', JSON.stringify(r, null, 2));
  await page.screenshot({ path: '.tmp-test/shots/guest-feed.png' });
  console.log('ERRORS', JSON.stringify(errs.slice(0, 5)));
  await browser.close();
})();
