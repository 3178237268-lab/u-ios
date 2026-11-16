
const { chromium } = require('playwright-core');
const fs = require('node:fs'); const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 3, colorScheme: 'dark' })).newPage();
  await page.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => {
    localStorage.setItem('u-theme', 'dark');
    const now = Date.now();
    localStorage.setItem('u-msgs', JSON.stringify([{ id: 'dm_a', type: 'dm', text: '111', createdAt: now - 20000, read: false, user: { name: '111', handle: '111', key: 'u_111' } }]));
  });
  await page.reload({ waitUntil: 'load' }); await sleep(800);
  await page.evaluate(() => { const t = document.querySelector('.tab[data-tab="dm"]'); if (t) t.click(); });
  await sleep(1200);
  const styles = await page.evaluate(() => {
    const sw = document.querySelector('.swipe'); const row = sw && sw.querySelector('.msg-row');
    const pick = (el, sel) => { if (!el) return null; const c = getComputedStyle(el); return { bg: c.backgroundColor, img: c.backgroundImage.slice(0, 80), border: c.borderColor, shadow: c.boxShadow, radius: c.borderRadius, cls: el.className }; };
    const box = document.querySelector('#dmList');
    const listStyles = box ? { bg: getComputedStyle(box).backgroundColor, img: getComputedStyle(box).backgroundImage.slice(0, 90) } : null;
    return { swipe: pick(sw), row: pick(row), del: pick(document.querySelector('.swipe-del')), list: listStyles, tabBg: getComputedStyle(document.body).backgroundColor };
  });
  const box = await page.evaluate(() => { const sw = document.querySelector('.swipe'); const r = sw.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await page.screenshot({ path: path.join(ROOT, '.tmp-test', 'darkdm-card.png'), clip: { x: box.x + box.w - 90, y: box.y - 14, width: 110, height: box.h + 20 } });
  console.log(JSON.stringify({ styles }));
  await browser.close();
})().catch((e) => console.log(JSON.stringify({ fatal: String(e).slice(0, 200) })));
