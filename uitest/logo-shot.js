const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const file = 'file:///' + path.resolve('d:/deepseek/gouzuoqu/U/index.html').replace(/\\/g, '/');
  await page.goto(file, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    document.querySelector('#authScreen').classList.remove('on');
    document.querySelector('#authScreen').style.display = 'none';
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: '.tmp-test/shots/logo-top-dark.png', clip: { x: 120, y: 0, width: 160, height: 58 } });
  await page.evaluate(() => document.body.classList.add('light'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: '.tmp-test/shots/logo-top-light.png', clip: { x: 120, y: 0, width: 160, height: 58 } });
  await page.screenshot({ path: '.tmp-test/shots/logo-top-light-full.png', clip: { x: 0, y: 0, width: 390, height: 58 } });
  await browser.close();
})();
