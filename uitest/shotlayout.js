const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader']
  });
  const ctx = await b.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await wait(2200);
  await p.locator('#guestBtn').click();
  await wait(1500);
  await p.evaluate(() => { const d = document.querySelector('#sideDrawer'); if (d) d.classList.add('open'); const b2 = document.querySelector('#sideBackdrop'); if (b2) b2.classList.add('open'); });
  await wait(500);
  await p.locator('[data-side="game"]').click({ force: true });
  await wait(1800);
  await p.locator('#shStartBtn').click();
  await wait(3200);
  await p.locator('#shOptBtn').click();
  await wait(700);
  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\game-opts.png' });
  await p.locator('#shLayoutBtn').click();
  await wait(900);
  // 把开火键往左上拖一点，展示可拖动
  const box = await p.locator('#shFire').boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await p.mouse.move(box.x - 40, box.y - 60, { steps: 10 });
  await p.mouse.up();
  await wait(500);
  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\game-layout.png' });
  console.log('shots done');
  await b.close();
})();
