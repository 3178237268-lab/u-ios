const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const out = [];
  for (const w of [412, 360]) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 }, hasTouch: true, isMobile: true });
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await page.fill('#authUser', 'nb92201');
    await page.fill('#authPass', 'pass12345');
    await page.click('#authSubmit');
    await page.waitForTimeout(2500);
    await page.evaluate(() => { document.getElementById('settingsSheet').classList.add('open'); document.body.classList.add('auth-settings'); });
    await page.waitForTimeout(500);
    const clicked = await page.evaluate(() => {
      const all = [...document.querySelectorAll('.set-row')];
      const row = all.find(r => (r.textContent || '').indexOf('互联网设置') >= 0);
      if (row) { row.click(); return true; }
      return false;
    });
    await page.waitForTimeout(900);
    const info = await page.evaluate(() => {
      const st = document.getElementById('srvSheetStatus');
      const b = st.getBoundingClientRect();
      const card = st.closest('.settings-card') || st.parentElement;
      return {
        open: document.getElementById('netSheet').classList.contains('open'),
        txt: st.innerText.replace(/\n/g, ' | ').slice(0, 200),
        right: Math.round(b.right), h: Math.round(b.height),
        cardRight: Math.round(card.getBoundingClientRect().right),
        doc: document.documentElement.scrollWidth - innerWidth
      };
    });
    await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/r166-net-real-' + w + '.png' });
    out.push({ w, clicked, ...info, errs });
    await page.close();
  }
  console.log(JSON.stringify(out));
  await browser.close();
})();