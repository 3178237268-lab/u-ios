const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  for (const scheme of ['dark', 'light']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme });
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(2000);
    await p.click('#guestBtn');
    await p.waitForTimeout(1500);
    await p.evaluate(() => {
      const v = document.querySelector('.view.on');
      const d = document.createElement('div');
      d.id = 'blurProbe';
      d.style.cssText = 'height:1200px;margin:0 12px;border-radius:16px;background:repeating-linear-gradient(90deg,#ff0000 0 20px,#00ff00 20px 40px,#0000ff 40px 60px,#ffff00 60px 80px);';
      v.style.paddingBottom = '0px';
      v.appendChild(d);
      v.scrollTop = v.scrollHeight;
    });
    await p.waitForTimeout(600);
    await p.screenshot({ path: `.tmp-test/shots/dock-blur-${scheme}.png`, clip: { x: 0, y: 690, width: 390, height: 154 } });
    const cs = await p.evaluate(() => {
      const t = document.querySelector('.tabbar');
      const s = getComputedStyle(t);
      return { bg: s.backgroundColor, img: s.backgroundImage, bf: s.backdropFilter || s.webkitBackdropFilter };
    });
    console.log(scheme, JSON.stringify(cs));
    await ctx.close();
  }
  await b.close();
})();
