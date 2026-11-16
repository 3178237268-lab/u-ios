const { chromium } = require('playwright-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const b = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const pg = await b.newPage({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
  const errs = [];
  pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load', timeout: 30000 });
  await pg.waitForTimeout(1500);
  try { await pg.click('#guestBtn', { timeout: 4000 }); } catch (e) {}
  await pg.waitForTimeout(3000);
  await pg.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\r35-home.png' });
  await pg.click('.tab[data-tab="notify"]').catch(() => {});
  await pg.waitForTimeout(1200);
  await pg.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\r35-notify.png' });
  await pg.click('.tab[data-tab="dm"]').catch(() => {});
  await pg.waitForTimeout(1200);
  await pg.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\r35-dm.png' });
  await pg.click('.tab[data-tab="search"]').catch(() => {});
  await pg.waitForTimeout(1200);
  await pg.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\r35-search.png' });
  console.log(JSON.stringify({ errs: errs.slice(0, 3) }));
  await b.close();
  process.exit(0);
})();
