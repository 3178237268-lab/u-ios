const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: false, hasTouch: true, colorScheme: 'dark' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(2000);
  await p.click('#guestBtn');
  await p.waitForTimeout(1600);

  // 右滑打开抽屉，采样左边缘位置
  await p.mouse.move(40, 500);
  await p.mouse.down();
  for (let i = 1; i <= 10; i++) { await p.mouse.move(40 + i * 12, 500); await p.waitForTimeout(16); }
  await p.mouse.up();
  const trace = await p.evaluate(async () => {
    const d = document.querySelector('#sideDrawer');
    const out = [];
    const t0 = performance.now();
    await new Promise(res => {
      (function tick() {
        out.push([Math.round(performance.now() - t0), Math.round(d.getBoundingClientRect().left * 10) / 10]);
        if (performance.now() - t0 < 600) requestAnimationFrame(tick); else res();
      })();
    });
    return out;
  });
  console.log('drawerLeft', JSON.stringify(trace));

  // 长按收藏按钮
  const box = await p.locator('.side-item[data-side="favorites"]').boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  const shots = [];
  for (let i = 0; i < 5; i++) {
    await p.waitForTimeout(250);
    const path = `.tmp-test/shots/longpress-${i}.png`;
    await p.screenshot({ path });
    shots.push(path);
  }
  const st = await p.evaluate(() => {
    const el = document.querySelector('#sideDrawer');
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, w: r.width, sw: el.scrollWidth, cw: el.clientWidth, overX: getComputedStyle(el).overflowX, overY: getComputedStyle(el).overflowY, userSelect: getComputedStyle(el).userSelect, touchAction: getComputedStyle(el).touchAction };
  });
  await p.mouse.up();
  console.log('drawerBox', JSON.stringify(st));
  console.log('ERRORS', JSON.stringify(errs.slice(0, 3)));
  await ctx.close();
  await b.close();
})();
