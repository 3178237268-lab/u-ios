const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 412, height: 900 }, hasTouch: true, isMobile: true });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.fill('#authUser', 'nb92201');
  await page.fill('#authPass', 'pass12345');
  await page.click('#authSubmit');
  await page.waitForTimeout(2500);
  const opened = await page.evaluate(() => {
    document.getElementById('settingsSheet').classList.add('open');
    document.body.classList.add('auth-settings');
    return true;
  });
  await page.waitForTimeout(600);
  const info = await page.evaluate(() => {
    const row = document.querySelector('#srvStatus');
    return { has: !!row, txt: row ? row.textContent.slice(0, 80) : null };
  });
  await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/r166-settings-logged.png' });
  console.log(JSON.stringify({ opened, info, errs }));
  await browser.close();
})();