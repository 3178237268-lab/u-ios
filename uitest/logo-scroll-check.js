const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(2000);
  await p.click('#guestBtn');
  await p.waitForTimeout(1600);
  const before = await p.evaluate(() => {
    const v = document.querySelector('.view.on');
    const pad = document.createElement('div');
    pad.style.height = '2400px';
    v.appendChild(pad);
    v.scrollTop = 900;
    return v.scrollTop;
  });
  const samples = await p.evaluate(async () => {
    const v = document.querySelector('.view.on');
    const out = [];
    document.querySelector('#logoBtn').click();
    const t0 = performance.now();
    await new Promise(res => {
      (function tick() {
        out.push([Math.round(performance.now() - t0), v.scrollTop]);
        if (performance.now() - t0 < 500) requestAnimationFrame(tick); else res();
      })();
    });
    return { out: out.filter((_, i) => i % 3 === 0), final: v.scrollTop };
  });
  console.log('scrollBefore', before);
  console.log('samples', JSON.stringify(samples.out));
  console.log('final', samples.final);
  console.log('ERRORS', JSON.stringify(errs.slice(0, 3)));
  await ctx.close();
  await b.close();
})();
