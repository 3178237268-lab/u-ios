const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 950 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const api = []; p.on('response', async r => { if (r.url().includes('/api/admin/net')) api.push(r.url() + ' ' + r.status()); });
  await p.goto('http://127.0.0.1:8787/admin.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(500);
  await p.fill('#lgUser', 'admin123'); await p.fill('#lgPass', 'admin123');
  await p.click('.login-card .btn'); await p.waitForTimeout(2200);
  await p.click('.tabs .tab[data-tab="net"]'); await p.waitForTimeout(1500);
  const snap = await p.evaluate(() => {
    const o = {};
    ['netKv','portListKv','tunnelKv','visitorKv'].forEach(id => {
      const c = document.getElementById(id);
      o[id] = { inner: c.innerHTML.slice(0, 200), rows: c.querySelectorAll('.row').length };
    });
    return o;
  });
  console.log(JSON.stringify({ snap, api, errs }, null, 1));
  await b.close();
})();
