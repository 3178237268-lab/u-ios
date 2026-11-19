const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8787/admin.html', { waitUntil: 'domcontentloaded' });
  await page.fill('#lgUser', 'admin123'); await page.fill('#lgPass', 'admin123');
  await page.press('#lgPass', 'Enter'); await page.waitForTimeout(1500);
  const report = [];
  for (const tab of ['posts', 'media', 'feedback', 'userdata', 'users', 'versions']) {
    await page.click('[data-tab="' + tab + '"]');
    await page.waitForTimeout(1100);
    const r = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('#view-' + '' + ' table .btn')].slice(0, 40);
      const wrapped = btns.filter(b => b.getBoundingClientRect().height > 40).length;
      const delBtns = [...document.querySelectorAll('.btn')].filter(b => b.textContent.trim() === '删除');
      const tall = delBtns.filter(b => b.getBoundingClientRect().height > 44).length;
      return { wrapped, delCount: delBtns.length, tall, overflow: document.documentElement.scrollWidth - innerWidth };
    }).catch(e => ({ err: String(e) }));
    await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/r165-' + tab + '.png' });
    report.push({ tab, ...r });
  }
  console.log(JSON.stringify({ report, errs }));
  await browser.close();
})();