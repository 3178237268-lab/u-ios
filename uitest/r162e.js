const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('http://127.0.0.1:8787/admin.html', { waitUntil: 'domcontentloaded' });
  await page.fill('#lgUser', 'admin123'); await page.fill('#lgPass', 'admin123');
  await page.press('#lgPass', 'Enter'); await page.waitForTimeout(1200);
  await page.click('[data-tab="settings"]'); await page.waitForTimeout(800);
  const box = await page.locator('.switch-row input').first().boundingBox();
  const read = () => page.evaluate(() => { const el = document.querySelector('.switch-row input');
    const cs = getComputedStyle(el, '::after'); return { w: cs.width, t: cs.transform, active: el.matches(':active') }; });
  const before = await read();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(80);
  const during = await read();
  await page.mouse.up();
  await page.waitForTimeout(300);
  const after = await read();
  // 按钮按下回弹
  const b = await page.locator('#refreshBtn').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down(); await page.waitForTimeout(70);
  const btnDuring = await page.evaluate(() => getComputedStyle(document.querySelector('#refreshBtn')).transform);
  await page.mouse.up(); await page.waitForTimeout(120);
  const btnMid = await page.evaluate(() => getComputedStyle(document.querySelector('#refreshBtn')).transform);
  console.log(JSON.stringify({ before, during, after, btnDuring, btnMid }));
  await browser.close();
})();