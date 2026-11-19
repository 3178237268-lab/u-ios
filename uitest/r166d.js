const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const out = [];
  for (const w of [412, 360]) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 }, hasTouch: true, isMobile: true });
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    const info = await page.evaluate(() => {
      document.getElementById('settingsSheet').classList.add('open');
      const sh = document.getElementById('netSheet');
      sh.classList.add('open');
      const st = document.getElementById('srvSheetStatus');
      st.textContent = '已连接 http://192.168.1.217:8787 · U 官方\n公网 https://u.serveousercontent.com?serveo-skip-browser-warning=true\n手机 App 环境 · 已保存 3 个端口';
      const b = st.getBoundingClientRect();
      const card = st.closest('.settings-card') || st.parentElement;
      return { statusRight: Math.round(b.right), statusH: Math.round(b.height), cardRight: Math.round(card.getBoundingClientRect().right), doc: document.documentElement.scrollWidth - innerWidth };
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/r166-netsheet-' + w + '.png' });
    out.push({ w, ...info, errs });
    await page.close();
  }
  console.log(JSON.stringify(out));
  await browser.close();
})();