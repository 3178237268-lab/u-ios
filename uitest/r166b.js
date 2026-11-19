const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 412, height: 900 }, hasTouch: true, isMobile: true });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => {
    document.getElementById('settingsSheet').classList.add('open');
    const el = document.getElementById('srvStatus');
    el.innerHTML = '<span class="srv-l1">已连接 http://192.168.1.217:8787 · U 官方</span>' +
      '<span class="srv-l2">公网 https://u.serveousercontent.com?serveo-skip-browser-warning=true</span>';
    const row = el.closest('.set-row');
    row.scrollIntoView({ block: 'center' });
    const b = el.getBoundingClientRect(), r = row.getBoundingClientRect();
    return { elRight: Math.round(b.right), elH: Math.round(b.height), rowRight: Math.round(r.right), doc: document.documentElement.scrollWidth - innerWidth };
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/r166-net-panel.png' });
  console.log(JSON.stringify({ info, errs }));
  await browser.close();
})();