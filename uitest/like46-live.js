
const { chromium } = require('playwright-core');
const fs = require('node:fs'); const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const URL = 'http://127.0.0.1:8765/';
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'load', timeout: 40000 });
  await page.evaluate(() => { localStorage.setItem('u-theme', 'light'); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2000);
  if (await page.$('#guestBtn')) { await page.click('#guestBtn').catch(() => {}); await page.waitForTimeout(2500); }
  await page.waitForTimeout(3000);
  const before = await page.evaluate(() => ({ light: document.body.classList.contains('light'), posts: document.querySelectorAll('#feedList .post').length, likes: document.querySelectorAll('#feedList .pactions .like').length }));
  const click = await page.evaluate(() => { const b = document.querySelector('#feedList .pactions .like'); if (!b) return 'none'; const had = b.classList.contains('on'); b.click(); return { had, span: (b.querySelector('span') || {}).textContent }; });
  await page.waitForTimeout(1600);
  const after = await page.evaluate(() => { const b = document.querySelector('#feedList .pactions .like'); if (!b) return null; const cs = getComputedStyle(b); const r = b.getBoundingClientRect(); return { on: b.classList.contains('on'), color: cs.color, fill: (() => { const p = b.querySelector('svg path'); return p ? getComputedStyle(p).fill : 'none'; })(), rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }; });
  console.log('BEFORE ' + JSON.stringify(before));
  console.log('CLICK ' + JSON.stringify(click));
  console.log('AFTER ' + JSON.stringify(after));
  if (after && after.rect && after.rect.h > 0) {
    await page.screenshot({ path: path.join(ROOT, 'uitest', 'like-live.png'), clip: { x: 0, y: Math.max(0, after.rect.y - 26), width: 420, height: Math.min(120, 900 - Math.max(0, after.rect.y - 26)) } }).catch(() => {});
  }
  console.log('ERRS ' + JSON.stringify(errs.slice(0, 3)));
  await browser.close(); process.exit(0);
})().catch((e) => { console.log('ERR ' + e.stack); process.exit(1); });