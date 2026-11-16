
const { chromium } = require('playwright-core');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 3 })).newPage();
  await page.goto('http://127.0.0.1:8765/', { waitUntil: 'load', timeout: 40000 });
  await page.waitForTimeout(1500);
  if (await page.$('#guestBtn')) { await page.click('#guestBtn').catch(() => {}); await page.waitForTimeout(3000); }
  await page.evaluate(() => {
    const now = Date.now();
    const msgs = [];
    for (let i = 1; i <= 9; i++) msgs.push({ id: 'nt' + i, type: i % 3 === 0 ? 'follow' : 'like', user: { name: '阿柚' + i, handle: 'bot_0' + i, key: 'bot_0' + i }, postId: 'p1', createdAt: now - i * 60000, read: false });
    for (let i = 1; i <= 5; i++) msgs.push({ id: 'dm' + i, type: 'dm', from: 'bot_0' + i, text: '私信内容 ' + i, createdAt: now - i * 120000, read: false, peer: { name: '阿柚' + i, handle: 'bot_0' + i } });
    localStorage.setItem('u-msgs', JSON.stringify(msgs));
    localStorage.setItem('u-theme', 'dark');
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const info = await page.evaluate(() => {
    const pick = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { text: el.textContent.trim(), on: el.classList.contains('on'), display: getComputedStyle(el).display, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    return { bell: pick('#ntTabBadge'), dmTab: pick('#dmTabBadge'), dmDot: pick('#dmDot'), scrollY: window.scrollY };
  });
  console.log('INFO ' + JSON.stringify(info));
  await page.screenshot({ path: path.join(ROOT, 'uitest', 'badge-dm-dark.png'), clip: { x: 0, y: 780, width: 420, height: 120 } });
  await page.evaluate(() => { const t = document.querySelector('.tab[data-tab="dm"]'); if (t) t.click(); });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ROOT, 'uitest', 'badge-dm-page.png'), clip: { x: 0, y: 0, width: 420, height: 260 } });
  await browser.close(); process.exit(0);
})().catch((e) => { console.log('ERR ' + e.stack); process.exit(1); });