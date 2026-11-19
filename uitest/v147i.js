const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 950 } });
  const logs = [], errs = [], api = [];
  p.on('console', m => logs.push(m.type() + ': ' + m.text()));
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', async r => { if (r.url().includes('/api/admin/net')) api.push(r.url() + ' ' + r.status()); });
  await p.goto('http://127.0.0.1:8787/admin.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(500);
  await p.fill('#lgUser', 'admin123'); await p.fill('#lgPass', 'admin123');
  await p.click('.login-card .btn'); await p.waitForTimeout(2200);
  const tok = await p.evaluate(() => localStorage.getItem('u-admin-token'));
  const direct = await p.evaluate(async () => {
    const t = localStorage.getItem('u-admin-token');
    const r = await fetch('/api/admin/net', { headers: { Authorization: 'Bearer ' + t } });
    const j = await r.json().catch(() => ({}));
    return { status: r.status, keys: Object.keys(j), err: j.error };
  });
  await p.click('.tabs .tab[data-tab="net"]'); await p.waitForTimeout(2000);
  const after = await p.evaluate(() => ({ tab: document.querySelector('.tab.on').dataset.tab, rows: document.getElementById('netKv').querySelectorAll('.row').length }));
  console.log(JSON.stringify({ tok: tok ? tok.slice(0, 12) : null, direct, api, after, logs: logs.slice(-8), errs }, null, 1));
  await b.close();
})();
