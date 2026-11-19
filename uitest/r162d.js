const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8787/admin.html', { waitUntil: 'domcontentloaded' });
  await page.fill('#lgUser', 'admin123'); await page.fill('#lgPass', 'admin123');
  await page.press('#lgPass', 'Enter'); await page.waitForTimeout(1200);
  await page.click('[data-tab="settings"]'); await page.waitForTimeout(900);
  await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/r162-settings.png' });
  // 开关果冻：按下时滑块应拉长
  const sw = await page.evaluate(async () => {
    const el = document.querySelector('.switch-row input');
    const knob = () => getComputedStyle(el, '::after').width;
    const before = knob();
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    const during = knob();
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await new Promise(r => setTimeout(r, 400));
    return { before, during };
  });
  await page.click('[data-tab="versions"]'); await page.waitForTimeout(700);
  await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/r162-versions2.png' });
  console.log(JSON.stringify({ sw, errs }));
  await browser.close();
})();