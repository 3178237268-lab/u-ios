const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  for (const scheme of ['dark', 'light']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1800);
    await p.click('#guestBtn');
    await p.waitForTimeout(1600);
    const m = await p.evaluate(() => {
      const bar = document.querySelector('.tabbar');
      const r = bar.getBoundingClientRect();
      const on = document.querySelector('.tab.on');
      const cs = getComputedStyle(bar);
      return {
        rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
        radius: cs.borderRadius, bg: cs.backgroundColor,
        labels: Array.from(document.querySelectorAll('.tabbar .tab-label')).map(x => ({ t: x.textContent, op: getComputedStyle(x).opacity, fs: getComputedStyle(x).fontSize })),
        selected: on ? on.dataset.tab : null,
        logo: (() => { const s = document.querySelector('#logoBtn svg rect'); return s ? { fill: s.getAttribute('fill'), w: s.getBoundingClientRect().width } : null; })()
      };
    });
    console.log(scheme, JSON.stringify(m));
    await p.screenshot({ path: `.tmp-test/shots/dock-${scheme}.png` });
    console.log('ERRORS', scheme, JSON.stringify(errs.slice(0, 3)));
    await ctx.close();
  }
  await b.close();
})();
