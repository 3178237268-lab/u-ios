const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('http://127.0.0.1:8787/admin.html', { waitUntil: 'domcontentloaded' });
  const found = await page.evaluate(() => {
    const hits = [];
    for (const ss of document.styleSheets) {
      let rules; try { rules = ss.cssRules } catch (e) { continue }
      for (const r of rules) {
        if (!r.selectorText) continue;
        if (r.selectorText.includes('.switch-row input:checked:active::after')) hits.push('switch-active');
        if (r.selectorText.includes('file-selector-button')) hits.push('filebtn');
        if (r.selectorText.includes('.btn.ico')) hits.push('ico');
        if (r.selectorText.includes('.view-in')) hits.push('viewin');
      }
    }
    return [...new Set(hits)];
  });
  console.log(JSON.stringify(found));
  await browser.close();
})();