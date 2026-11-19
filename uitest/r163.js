const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8787/admin.html', { waitUntil: 'domcontentloaded' });
  await page.fill('#lgUser', 'admin123'); await page.fill('#lgPass', 'admin123');
  await page.press('#lgPass', 'Enter'); await page.waitForTimeout(1400);
  const probe = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#serverKv .row')];
    return rows.map(r => {
      const lab = r.children[0], val = r.children[1];
      const lb = lab.getBoundingClientRect(), vb = val && val.getBoundingClientRect();
      return { label: lab.textContent.trim(), labW: Math.round(lb.width), labH: Math.round(lb.height),
        valW: vb ? Math.round(vb.width) : null, valH: vb ? Math.round(vb.height) : null,
        gap: vb ? Math.round(vb.left - lb.right) : null,
        dotted: getComputedStyle(lab, '::after').borderBottomStyle };
    });
  });
  await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/r163-overview.png' });
  await page.click('[data-tab="net"]'); await page.waitForTimeout(900);
  await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/r163-net.png' });
  await page.click('[data-tab="live"]'); await page.waitForTimeout(900);
  await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/r163-live.png' });
  console.log(JSON.stringify({ probe, errs }));
  await browser.close();
})();