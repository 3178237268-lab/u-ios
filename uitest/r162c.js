const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const out = {};
  for (const vp of [{ w: 1280, h: 860, tag: 'desk' }, { w: 412, h: 915, tag: 'mobile' }]) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, hasTouch: vp.tag === 'mobile' });
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto('http://127.0.0.1:8787/admin.html', { waitUntil: 'domcontentloaded' });
    await page.fill('#lgUser', 'admin123'); await page.fill('#lgPass', 'admin123');
    await page.press('#lgPass', 'Enter'); await page.waitForTimeout(1300);
    const m = await page.evaluate(() => {
      const t = document.querySelector('.tabs');
      const last = document.querySelector('.tab[data-tab="api"]');
      const lb = last.getBoundingClientRect();
      return { overflow: t.scrollWidth - t.clientWidth, lastRight: Math.round(lb.right), vw: innerWidth,
        tabOn: document.querySelector('.tab.on').textContent.trim(), radius: getComputedStyle(document.querySelector('.btn')).borderRadius };
    });
    if (vp.tag === 'mobile') { await page.click('[data-tab="versions"]'); await page.waitForTimeout(600);
      await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/r162-mobile.png' }); }
    out[vp.tag] = { ...m, errs };
    await page.close();
  }
  console.log(JSON.stringify(out));
  await browser.close();
})();