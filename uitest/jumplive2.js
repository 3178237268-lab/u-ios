const { chromium } = require('playwright-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await b.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load', timeout: 60000 });
  await sleep(2500);
  await page.evaluate(() => window.openJumpGame());
  await sleep(1500);
  for (let i = 0; i < 40; i++) { const s = await page.evaluate(() => window.jumpGameState()); if (s.built) break; await sleep(400); }
  await page.click('#jumpStartBtn');
  await sleep(700);
  const s0 = await page.evaluate(() => window.jumpGameState());
  const target = Math.max(0.02, Math.min(0.98, (s0.gap - 1.7) / 5.6));
  await page.mouse.move(210, 620); await page.mouse.down();
  for (let i = 0; i < 260; i++) { const s = await page.evaluate(() => window.jumpGameState()); if (s.phase !== 'charge' || s.power >= target - 0.012) break; await sleep(12); }
  await page.mouse.up();
  for (let i = 0; i < 100; i++) { const s = await page.evaluate(() => window.jumpGameState()); if (s.phase !== 'jump') break; await sleep(35); }
  const after = await page.evaluate(() => window.jumpGameState());
  await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/uitest/jump-live2.png' });
  console.log('LIVE built=' + after.built + ' phase=' + after.phase + ' score=' + after.score + ' errs=' + JSON.stringify(errs));
  await b.close(); process.exit(0);
})().catch((e) => { console.log('ERR ' + e.stack); process.exit(1); });