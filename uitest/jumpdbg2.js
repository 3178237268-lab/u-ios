const { chromium } = require('playwright-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await b.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load', timeout: 60000 });
  await sleep(2500);
  await page.evaluate(() => window.openJumpGame());
  await sleep(1500);
  for (let i = 0; i < 40; i++) { const s = await page.evaluate(() => window.jumpGameState()); if (s.built) break; await sleep(400); }
  const info = await page.evaluate(() => {
    const b = document.getElementById('jumpStartBtn'); const c = document.getElementById('jmStart'); const sh = document.getElementById('jumpSheet');
    const r = b.getBoundingClientRect(); const cs = getComputedStyle(b); const cc = getComputedStyle(c);
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { rect: [r.x, r.y, r.width, r.height], vis: cs.visibility, disp: cs.display, op: cs.opacity, ptr: cs.pointerEvents, cardVis: cc.visibility, cardOp: cc.opacity, cardDisp: cc.display, sheetCls: sh.className, hit: hit ? (hit.id || hit.className) : null, state: window.jumpGameState() };
  });
  console.log('BEFORE ' + JSON.stringify(info));
  console.log('ERRS ' + JSON.stringify(errs));
  await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/uitest/jump-live-dbg2.png' });
  await b.close(); process.exit(0);
})().catch((e) => { console.log('ERR ' + e.stack); process.exit(1); });