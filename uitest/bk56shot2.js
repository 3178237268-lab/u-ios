
const { chromium } = require('playwright-core');
(async () => {
  const out = { errs: [] };
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox','--disable-gpu'] });
  const page = await b.newPage({ viewport: { width: 1360, height: 900 } });
  page.on('pageerror', e => out.errs.push(String(e).slice(0,120)));
  await page.goto('http://127.0.0.1:8787/admin', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  await page.fill('#lgUser', 'admin123'); await page.fill('#lgPass', 'admin123');
  await page.click('#loginForm button[type=submit]');
  await page.waitForTimeout(2600);
  out.rowH = await page.evaluate(() => Array.from(document.querySelectorAll('#backupList tr')).map(tr => Math.round(tr.getBoundingClientRect().height)));
  out.cells = await page.evaluate(() => Array.from(document.querySelectorAll('#backupList tr')).map(tr => Array.from(tr.children).map(td => Math.round(td.getBoundingClientRect().width))));
  const p = await page.$('#view-overview .panel:last-child');
  if (p) await p.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/bk56-panel2.png' });
  await b.close(); console.log(JSON.stringify(out));
})();
