const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: false, hasTouch: true, colorScheme: 'dark' });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(2000);
  await p.click('#guestBtn');
  await p.waitForTimeout(1600);
  await p.mouse.move(40, 500);
  await p.mouse.down();
  for (let i = 1; i <= 10; i++) { await p.mouse.move(40 + i * 12, 500); await p.waitForTimeout(16); }
  await p.mouse.up();
  await p.waitForTimeout(800);
  const clip = { x: 300, y: 0, width: 90, height: 844 };
  await p.screenshot({ path: '.tmp-test/shots/drawer-right-before.png', clip });
  const box = await p.locator('.side-item[data-side="favorites"]').boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await p.waitForTimeout(600);
  await p.screenshot({ path: '.tmp-test/shots/drawer-right-hold.png', clip });
  const info = await p.evaluate(() => {
    const at = document.elementFromPoint(385, 400);
    const d = document.querySelector('#sideDrawer');
    const cs = getComputedStyle(d);
    return {
      topEl: at ? (at.id || at.className || at.tagName) : null,
      drawer: { overflow: cs.overflow, isolation: cs.isolation, filter: cs.filter, backdrop: cs.backdropFilter, right: d.getBoundingClientRect().right },
      bodyScrollW: document.body.scrollWidth, docW: document.documentElement.clientWidth,
      appW: document.querySelector('.app').getBoundingClientRect().width,
      sel: String(window.getSelection())
    };
  });
  await p.mouse.up();
  console.log(JSON.stringify(info));
  await ctx.close();
  await b.close();
})();
