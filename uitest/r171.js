
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  const r = await page.request.post('http://127.0.0.1:8787/api/login', { data: { username: 'admin123', password: 'admin123' } });
  const j = await r.json();
  await page.addInitScript(t => localStorage.setItem('u-admin-token', t), j.token);
  await page.goto('http://127.0.0.1:8787/admin.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.evaluate(() => window.scrollTo(0, 330));
  await page.waitForTimeout(500);
  const info = await page.evaluate(() => {
    const tb = document.querySelector('.topbar');
    const cs = getComputedStyle(tb);
    return { top: tb.getBoundingClientRect().top, bg: cs.backgroundImage.slice(0, 80), border: cs.borderBottomColor, stuck: tb.classList.contains('stuck'), scrollY: Math.round(window.scrollY) };
  });
  console.log(JSON.stringify(info));
  await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/r171-topbar.png' });
  console.log('errs', errs);
  await browser.close();
})();
