
const { chromium } = require('playwright-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-first-run'] });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
  await page.goto('http://127.0.0.1:8765/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(() => { const b = document.querySelector('#guestBtn'); if (b) b.click(); });
  await sleep(5000);
  const dom = await page.evaluate(() => Array.from(document.querySelectorAll('.pmedia .vplayer')).map((vp) => { const v = vp.querySelector('video'); const t = vp.querySelector('.vtime'); return { cls: vp.className.replace('vplayer', '').trim(), poster: !!(v && v.getAttribute('poster')), rs: v ? v.readyState : -1, time: t ? t.textContent : '' }; }));
  console.log(JSON.stringify({ dom, errs }));
  await browser.close();
})().catch((e) => console.log(JSON.stringify({ fatal: String(e).slice(0, 160) })));
