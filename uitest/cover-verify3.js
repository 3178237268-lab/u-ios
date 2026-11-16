
const { chromium } = require('playwright-core');
const path = require('node:path');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
  await page.goto('http://127.0.0.1:8765/', { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => { const b = document.querySelector('#guestBtn'); if (b) b.click(); });
  await sleep(7000);
  const dom = await page.evaluate(() => Array.from(document.querySelectorAll('.pmedia .vplayer')).map((vp) => { const v = vp.querySelector('video'); const t = vp.querySelector('.vtime'); return { vid: vp.dataset.vid.slice(5, 13), cls: vp.className.replace('vplayer', '').trim(), poster: !!(v && v.getAttribute('poster')), rs: v ? v.readyState : -1, time: t ? t.textContent : '' }; }));
  const sensitive = await page.evaluate(() => Array.from(document.querySelectorAll('.pmedia .vplayer')).map((vp) => !!vp.closest('.post').querySelector('.sensitive, .nsfw, [data-sensitive]')).length);
  const shot = await page.evaluate(() => { const ps = Array.from(document.querySelectorAll('.post')); for (const p of ps) { const vp = p.querySelector('.vplayer'); if (vp && !p.querySelector('.sensitive, .blur, [data-sensitive]')) { const r = vp.getBoundingClientRect(); if (r.height > 60) return { x: 0, y: Math.max(0, r.y - 70), w: 420, h: Math.min(600, r.height + 110) }; } } return null; });
  if (shot) await page.screenshot({ path: path.join(__dirname, '..', '.tmp-test', 'cover-live2.png'), clip: shot });
  console.log(JSON.stringify({ dom, sensitive, shot: !!shot, errs }));
  await browser.close();
})().catch((e) => console.log(JSON.stringify({ fatal: String(e).slice(0, 200) })));
