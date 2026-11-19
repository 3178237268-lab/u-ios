const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 412, height: 900 }, hasTouch: true, isMobile: true });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const sheet = document.getElementById('settingsSheet');
    sheet.classList.add('open');
    // 优先找互联设置二级页
    const ids = ['srvSheet', 'srvSheetBody', 'netSheet'];
    return { sheet: !!sheet, ids: ids.map(i => ({ i, has: !!document.getElementById(i) })) };
  });
  console.log(JSON.stringify({ r, errs }));
  await browser.close();
})();