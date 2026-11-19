const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('http://127.0.0.1:8787/admin.html', { waitUntil: 'domcontentloaded' });
  await page.fill('#lgUser', 'admin123'); await page.fill('#lgPass', 'admin123');
  await page.press('#lgPass', 'Enter'); await page.waitForTimeout(1400);
  const m = await page.evaluate(() => {
    const kv = document.querySelector('#serverKv');
    const panel = kv.closest('.panel-body');
    const pb = panel.getBoundingClientRect();
    const rows = [...kv.querySelectorAll('.row')].map(r => {
      const v = r.children[1]; const vb = v.getBoundingClientRect();
      return { label: r.children[0].textContent.trim(), valRight: Math.round(vb.right), over: Math.round(vb.right - (pb.right - 18)) };
    });
    return { docOverflow: document.documentElement.scrollWidth - innerWidth,
      panelInnerRight: Math.round(pb.right - 18), maxOver: Math.max(...rows.map(r => r.over)), rows: rows.slice(0, 4) };
  });
  console.log(JSON.stringify(m));
  await browser.close();
})();