const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  });
  const ctx = await b.newContext({ viewport: { width: 430, height: 900 }, hasTouch: false, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + String(e).slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 160)); });
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await wait(2200);
  await p.locator('#guestBtn').click(); await wait(1200);
  const vis = await p.locator('.side-item[data-side="game"]:visible').count();
  if (!vis) { await p.mouse.move(8, 420); await p.mouse.down(); await p.mouse.move(320, 420, { steps: 12 }); await p.mouse.up(); await wait(700); }
  await p.locator('.side-item[data-side="game"]:visible').first().click();
  await wait(1000);
  await p.locator('#shStartBtn').click();
  await wait(6000);
  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\game-hip.png' });
  const stat = await p.evaluate(() => ({
    enemies: (window.__shooterEnemies || 0),
    hud: document.getElementById('shWave') && document.getElementById('shWave').textContent
  }));
  console.log('wave', stat.hud, 'errors', errs.length);
  errs.slice(0, 5).forEach(e => console.log('  ' + e));
  await b.close();
})();
