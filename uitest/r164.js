const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8787/admin.html', { waitUntil: 'domcontentloaded' });
  await page.fill('#lgUser', 'admin123'); await page.fill('#lgPass', 'admin123');
  await page.press('#lgPass', 'Enter'); await page.waitForTimeout(1500);
  const shots = [['overview','overview'],['live','live'],['users','users'],['posts','posts'],['media','media'],['userdata','userdata'],['logs','logs'],['history','history'],['api','api'],['versions','versions']];
  const report = [];
  for (const [tab, name] of shots) {
    await page.click('[data-tab="' + tab + '"]');
    await page.waitForTimeout(1000);
    const r = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth }));
    await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/r164-' + name + '.png' });
    report.push({ tab, ...r });
  }
  // 移动端
  await page.setViewportSize({ width: 412, height: 900 });
  await page.click('[data-tab="overview"]'); await page.waitForTimeout(900);
  await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/r164-mobile.png' });
  const mob = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth,
    kvCols: getComputedStyle(document.querySelector('#serverKv')).gridTemplateColumns }));
  console.log(JSON.stringify({ report, mob, errs }));
  await browser.close();
})();