
const { chromium } = require('playwright-core');
const path = require('node:path');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  await page.goto('http://127.0.0.1:8765/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(() => { const b = document.querySelector('#guestBtn'); if (b) b.click(); });
  await sleep(6000);
  const box = await page.evaluate(() => {
    for (const p of document.querySelectorAll('.post')) {
      const vp = p.querySelector('.vplayer'); if (!vp || vp.classList.contains('vgrid')) continue;
      const v = vp.querySelector('video'); if (!v || !v.getAttribute('poster')) continue;
      vp.scrollIntoView({ block: 'center' });
      const r = vp.getBoundingClientRect();
      return { x: Math.max(0, r.x - 10), y: Math.max(0, r.y - 8), w: Math.min(420, r.width + 20), h: Math.min(700, r.height + 16) };
    }
    return null;
  });
  await sleep(600);
  if (box) await page.screenshot({ path: path.join(__dirname, '..', '.tmp-test', 'cover-final.png'), clip: box });
  console.log(JSON.stringify({ shot: !!box, box }));
  await browser.close();
})().catch((e) => console.log(JSON.stringify({ fatal: String(e).slice(0, 160) })));
