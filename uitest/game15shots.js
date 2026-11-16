const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await b.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + String(e).slice(0, 160)));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 160)); });
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await wait(2200);
  await p.locator('#guestBtn').click();
  await wait(1500);
  await p.evaluate(() => document.querySelector('#sideDrawer').classList.add('open'));
  await wait(300);
  await p.evaluate(() => { const g = [...document.querySelectorAll('#sideDrawer button')].find(b => /游戏/.test(b.textContent)); g && g.click(); });
  await wait(5000);
  /* 换成林地地图 + 突击步枪，回到默认组合，便于看敌人 */
  await p.evaluate(() => { document.querySelector('#shMapOpts button[data-map="warehouse"]').click(); });
  await wait(1400);
  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\lobby.png' });
  await p.locator('#shStartBtn').click();
  await wait(1800);
  /* 往前压，把敌人看清楚 */
  await p.evaluate(() => { const s = document.querySelector('#shStick'); s.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 60, clientY: 800 })); });
  await p.evaluate(() => { const s = document.querySelector('#shStick'); s.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: 60, clientY: 740 })); });
  await wait(3000);
  await p.evaluate(() => { const s = document.querySelector('#shStick'); s.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 })); });
  await wait(1200);
  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\enemy15.png' });
  console.log('errors ' + errs.length);
  errs.slice(0, 4).forEach(e => console.log('  ' + e));
  await b.close();
})();
