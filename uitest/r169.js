const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 412, height: 900 }, hasTouch: true, isMobile: true });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => {
    const items = [
      { p: 'n:/data/user/0/com.trae.u/cache/tw/1536_video.mp4', n: '1536_video.mp4', s: 5242880, t: 'video', w: 'app' },
      { p: 'c:content://media/external/video/media/7788', n: 'tw_1536.mp4', s: 3145728, t: 'video', w: 'movie' },
      { p: 'n:/data/user/0/com.trae.u/cache/img/cover.jpg', n: 'cover.jpg', s: 204800, t: 'image', w: 'app' },
      { p: 'c:content://media/external/downloads/9991', n: 'U-2.23.apk', s: 1377997, t: 'other', w: 'download' }
    ];
    window.UHost = { cacheScan: function () { return JSON.stringify({ bytes: 9965829, count: 4, items: items }); }, cacheDelete: function () { return '{"ok":1,"fail":0}'; }, listApks: function () { return '[]'; } };
  });
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { document.getElementById('settingsSheet').classList.add('open'); document.body.classList.add('auth-settings'); });
  await page.waitForTimeout(500);
  await page.evaluate(() => { const r = [...document.querySelectorAll('.set-row')].find(x => (x.textContent || '').indexOf('数据文件') >= 0); if (r) r.click(); });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/r169-data.png' });
  await page.evaluate(() => document.getElementById('storageOpen').click());
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/r169-cache.png' });
  const out = await page.evaluate(() => ({
    sub: (document.getElementById('storageSub') || {}).textContent,
    cacheSub: (document.getElementById('cacheSub') || {}).textContent,
    rows: [...document.querySelectorAll('#storageList .stor-row')].map(r => r.innerText.replace(/\n/g, ' ')),
    list: [...document.querySelectorAll('#cacheList .cache-row')].map(r => r.innerText.replace(/\n/g, ' | '))
  }));
  console.log(JSON.stringify({ out, errs }));
  await browser.close();
})();