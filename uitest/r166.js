const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const out = [];
  for (const w of [412, 360, 320]) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 }, hasTouch: true, isMobile: true });
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const r = await page.evaluate(() => {
      const el = document.getElementById('srvStatus');
      el.innerHTML = '<span class="srv-l1">已连接 http://192.168.1.217:8787 · U 官方</span>' +
        '<span class="srv-l2">公网 https://u.serveousercontent.com?serveo-skip-browser-warning=true</span>';
      const l1 = el.querySelector('.srv-l1'), l2 = el.querySelector('.srv-l2');
      const a = l1.getBoundingClientRect(), b = l2.getBoundingClientRect(), row = el.closest('.set-row').getBoundingClientRect();
      return {
        vw: innerWidth,
        l1: { right: Math.round(a.right), h: Math.round(a.height), scroll: l1.scrollWidth, client: l1.clientWidth },
        l2: { right: Math.round(b.right), h: Math.round(b.height), scroll: l2.scrollWidth, client: l2.clientWidth },
        rowRight: Math.round(row.right),
        docOverflow: document.documentElement.scrollWidth - innerWidth
      };
    });
    out.push({ w, ...r, errs });
    await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/r166-net-' + w + '.png' });
    await page.close();
  }
  console.log(JSON.stringify(out));
  await browser.close();
})();