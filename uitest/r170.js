
const { chromium } = require('playwright-core');
const path = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
(async () => {
  const browser = await chromium.launch({ executablePath: path, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  const r = await page.request.post('http://127.0.0.1:8787/api/login', { data: { username: 'admin123', password: 'admin123' } });
  const j = await r.json();
  await page.addInitScript(t => localStorage.setItem('u-admin-token', t), j.token);
  await page.goto('http://127.0.0.1:8787/admin.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const box = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('#view-overview .panel, #view-overview .stats').forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      out.push({ i, cls: el.className, top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), mb: cs.marginBottom, mt: cs.marginTop });
    });
    const sec = document.querySelector('#view-overview');
    const scs = getComputedStyle(sec);
    const row = document.querySelector('#serverKv .row');
    const spans = row ? [...row.querySelectorAll('span')].map(s => { const r = s.getBoundingClientRect(); return { t: s.textContent.trim().slice(0, 14), l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width) }; }) : [];
    return { panels: out, sectionDisplay: scs.display, sectionGap: scs.gap, sectionFlex: scs.flexDirection, row: spans, rowH: row ? Math.round(row.getBoundingClientRect().height) : 0 };
  });
  console.log(JSON.stringify(box, null, 1));
  console.log('errs', errs);
  await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/r170-admin-gap.png', clip: { x: 0, y: 0, width: 1440, height: 700 } });
  await browser.close();
})();
