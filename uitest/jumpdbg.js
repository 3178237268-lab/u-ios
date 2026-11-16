const { chromium } = require('playwright-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await b.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load', timeout: 60000 });
  await sleep(2500);
  const has = await page.evaluate(() => ({ fn: typeof window.openJumpGame, sheet: !!document.getElementById('jumpSheet'), btn: !!document.getElementById('jumpStartBtn'), state: window.jumpGameState ? window.jumpGameState() : null }));
  await page.evaluate(() => window.openJumpGame());
  await sleep(1500);
  const info = await page.evaluate(() => {
    const sh = document.getElementById('jumpSheet'); const b = document.getElementById('jumpStartBtn'); const c = document.getElementById('jmStart');
    const r = b.getBoundingClientRect(); const cs = getComputedStyle(b); const cr = c.getBoundingClientRect();
    return { sheetOpen: sh.className, shRect: [sh.getBoundingClientRect().width, sh.getBoundingClientRect().height], shVis: getComputedStyle(sh).visibility, shOpacity: getComputedStyle(sh).opacity, btnRect: [r.x, r.y, r.width, r.height], btnVis: cs.visibility, btnDisp: cs.display, cardCls: c.className, cardRect: [cr.width, cr.height], body: document.body.className };
  });
  console.log('HAS ' + JSON.stringify(has));
  console.log('INFO ' + JSON.stringify(info));
  console.log('ERRS ' + JSON.stringify(errs));
  await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/uitest/jump-live-dbg.png' });
  await b.close(); process.exit(0);
})().catch((e) => { console.log('ERR ' + e.stack); process.exit(1); });