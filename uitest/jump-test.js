
const { chromium } = require('playwright-core');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const SITE = 18841, PAGE = 'http://127.0.0.1:' + SITE + '/';
const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const f = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p);
  fs.readFile(f, (e, b) => {
    if (e) { res.writeHead(404); res.end('no'); return; }
    const ext = path.extname(f);
    const t = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.js' ? 'application/javascript' : 'application/octet-stream';
    res.writeHead(200, { 'content-type': t }); res.end(b);
  });
}).listen(SITE);
let pass = 0, fail = 0;
function ok(c, n, x) { if (c) { pass++; } else { fail++; console.log('FAIL ' + n + ' :: ' + JSON.stringify(x)); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.goto(PAGE, { waitUntil: 'load', timeout: 60000 });
  await sleep(2200);
  if (await page.$('#guestBtn')) { await page.click('#guestBtn').catch(() => {}); await sleep(1500); }
  const item = await page.evaluate(() => {
    const el = document.querySelector('[data-side=\"jump\"]');
    return el ? { text: el.textContent.trim(), h: el.getBoundingClientRect().height } : null;
  });
  ok(!!item && item.text.indexOf('跳一跳') >= 0 && item.h > 30, 'drawer has jump item', item);
  await page.evaluate(() => {
    document.getElementById('sideDrawer').classList.add('open');
    document.querySelector('[data-side=\"jump\"]').click();
  });
  await sleep(1200);
  const opened = await page.evaluate(() => ({ open: document.getElementById('jumpSheet').classList.contains('open'), z: getComputedStyle(document.getElementById('jumpSheet')).zIndex }));
  ok(opened.open, 'jump sheet opens from drawer', opened);
  let built = false;
  for (let i = 0; i < 40; i++) {
    const s = await page.evaluate(() => (window.jumpGameState ? window.jumpGameState() : null));
    if (s && s.built) { built = true; break; }
    await sleep(400);
  }
  ok(built, 'three.js scene built', built);
  await sleep(500);
  await page.screenshot({ path: path.join(ROOT, 'uitest', 'jump-start.png') });
  const startCard = await page.evaluate(() => {
    const c = document.getElementById('jmStart');
    const b = document.getElementById('jumpStartBtn');
    return { on: c.classList.contains('on'), btn: b.textContent, disabled: b.disabled };
  });
  ok(startCard.on && startCard.btn === '开始游戏' && !startCard.disabled, 'start card ready', startCard);
  await page.click('#jumpStartBtn');
  await sleep(600);
  const afterStart = await page.evaluate(() => window.jumpGameState());
  ok(afterStart.phase === 'ready', 'phase ready after start', afterStart);
  ok(!(await page.evaluate(() => document.getElementById('jmStart').classList.contains('on'))), 'start card hidden', null);

  async function jumpOnce(perfect) {
    const s = await page.evaluate(() => window.jumpGameState());
    const p = perfect ? Math.max(0.02, Math.min(0.99, (s.gap - 1.7) / 5.6)) : 0.03;
    const holdMs = Math.round(p * 1050);
    await page.mouse.move(210, 620);
    await page.mouse.down();
    await sleep(holdMs);
    await page.mouse.up();
    await sleep(900);
    return page.evaluate(() => window.jumpGameState());
  }

  const j1 = await jumpOnce(true);
  ok(j1.phase === 'ready' && j1.score === 2, 'perfect jump scores 2', j1);
  await page.screenshot({ path: path.join(ROOT, 'uitest', 'jump-play.png') });
  const j2 = await jumpOnce(true);
  ok(j2.score === 4, 'second perfect jump totals 4', j2);
  ok(j2.blocks >= 3, 'blocks accumulate', j2.blocks);
  const j3 = await jumpOnce(false);
  ok(j3.phase === 'fall' || j3.phase === 'over', 'short jump falls', j3);
  let over = null;
  for (let i = 0; i < 20; i++) {
    over = await page.evaluate(() => window.jumpGameState());
    if (over.phase === 'over') break;
    await sleep(300);
  }
  ok(over.phase === 'over', 'game over after fall', over);
  const overCard = await page.evaluate(() => ({
    on: document.getElementById('jmOver').classList.contains('on'),
    score: document.getElementById('jmOverScore').textContent,
    best: document.getElementById('jmOverBest').textContent,
    tip: document.getElementById('jmOverTip').textContent,
    bestStored: localStorage.getItem('u-jump-best')
  }));
  ok(overCard.on && overCard.score === '4', 'over card shows score 4', overCard);
  ok(overCard.bestStored === '4' && overCard.best === '4', 'best saved', overCard);
  await page.screenshot({ path: path.join(ROOT, 'uitest', 'jump-over.png') });
  await page.click('#jumpAgainBtn');
  await sleep(700);
  const again = await page.evaluate(() => window.jumpGameState());
  ok(again.phase === 'ready' && again.score === 0, 'again resets round', again);
  await page.click('#jumpClose');
  await sleep(500);
  const closed = await page.evaluate(() => ({ open: document.getElementById('jumpSheet').classList.contains('open'), body: document.body.classList.contains('jump-open') }));
  ok(!closed.open && !closed.body, 'close hides sheet', closed);
  ok(errs.length === 0, 'no pageerror', errs.slice(0, 3));
  console.log('RESULT ' + pass + '/' + (pass + fail));
  await browser.close(); site.close(); process.exit(0);
})().catch((e) => { console.log('ERR ' + e.stack); process.exit(1); });