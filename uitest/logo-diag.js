const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const file = 'file:///' + path.resolve('d:/deepseek/gouzuoqu/U/index.html').replace(/\\/g, '/');
  await page.goto(file, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const b = document.querySelector('#logoBtn');
    const svg = b.querySelector('svg');
    const p = svg.querySelector('path');
    const bb = p.getBBox();
    const top = document.elementFromPoint(195, 26);
    return {
      svgRect: svg.getBoundingClientRect().toJSON(),
      pathBBox: { x: bb.x, y: bb.y, w: bb.width, h: bb.height },
      fill: getComputedStyle(p).fill,
      opacity: getComputedStyle(b).opacity,
      visibility: getComputedStyle(b).visibility,
      parentDisplay: getComputedStyle(b.parentElement).display,
      topEl: top ? (top.id || top.className || top.tagName) : null,
      authZ: getComputedStyle(document.querySelector('#authScreen')).zIndex,
      authBg: getComputedStyle(document.querySelector('#authScreen')).backgroundColor,
      topbarZ: getComputedStyle(document.querySelector('.topbar')).zIndex
    };
  });
  console.log(JSON.stringify(r, null, 2));
  await page.screenshot({ path: '.tmp-test/shots/logo-top.png', clip: { x: 120, y: 0, width: 160, height: 60 } });
  await browser.close();
})();
