const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  for (const scheme of ['dark', 'light']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(2000);
    await p.click('#guestBtn');
    await p.waitForTimeout(1500);
    const before = await p.evaluate(() => {
      const lab = document.querySelector('.tab[data-tab="search"] .tab-label');
      const ic = document.querySelector('.tab[data-tab="search"] svg');
      return { labelOpacity: getComputedStyle(lab).opacity, icon: Math.round(ic.getBoundingClientRect().width) };
    });
    const box = await p.evaluate(() => {
      const r = document.querySelector('.tab[data-tab="search"]').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await p.mouse.move(box.x, box.y);
    await p.mouse.down();
    await p.waitForTimeout(1200);
    const during = await p.evaluate(() => {
      const lab = document.querySelector('.tab[data-tab="search"] .tab-label');
      const r = lab.getBoundingClientRect();
      const bar = document.querySelector('.tabbar').getBoundingClientRect();
      return { holding: document.querySelector('.tab[data-tab="search"]').classList.contains('holding'), opacity: getComputedStyle(lab).opacity, labelTop: Math.round(r.top), barTop: Math.round(bar.top) };
    });
    await p.screenshot({ path: `.tmp-test/shots/dock-hold-${scheme}.png`, clip: { x: 0, y: 700, width: 390, height: 144 } });
    await p.mouse.up();
    await p.waitForTimeout(400);
    const after = await p.evaluate(() => getComputedStyle(document.querySelector('.tab[data-tab="search"] .tab-label')).opacity);
    console.log(scheme, JSON.stringify({ before, during, after }), 'ERRORS', JSON.stringify(errs.slice(0, 3)));
    await ctx.close();
  }
  await b.close();
})();
