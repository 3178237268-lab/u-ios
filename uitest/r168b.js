const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 412, height: 900 }, hasTouch: true, isMobile: true });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => {
    const items = [
      { p: 'n:/data/user/0/com.trae.u/cache/webview/x.jpg', n: 'webview_x.jpg', s: 204800, t: 'image', w: 'app' },
      { p: 'n:/data/user/0/com.trae.u/cache/tw/a.mp4', n: 'tw_a.mp4', s: 3145728, t: 'video', w: 'app' },
      { p: 'c:content://media/external/downloads/9991', n: 'U-2.22.apk', s: 1373901, t: 'other', w: 'download' },
      { p: 'c:content://media/external/video/media/7788', n: 'tw_123.mp4', s: 5242880, t: 'video', w: 'movie' }
    ];
    window.UHost = {
      cacheScan: function () { return JSON.stringify({ bytes: 9965829, count: 4, items: items }); },
      cacheDelete: function (p) { return '{"ok":1,"fail":0}'; },
      listApks: function () { return '[]'; }
    };
  });
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.fill('#authUser', 'nc187971'); await page.fill('#authPass', 'pass12345'); await page.click('#authSubmit');
  await page.waitForTimeout(2600);
  const probe = await page.evaluate(async () => {
    const has = !!(window.UHost && window.UHost.cacheScan);
    const raw = has ? window.UHost.cacheScan() : null;
    return { has: has, rawLen: raw ? String(raw).length : 0, raw: raw ? String(raw).slice(0, 120) : '' };
  });
  await page.evaluate(() => { document.getElementById('settingsSheet').classList.add('open'); document.body.classList.add('auth-settings'); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { const r = [...document.querySelectorAll('.set-row')].find(x => (x.textContent || '').indexOf('数据文件') >= 0); if (r) r.click(); });
  await page.waitForTimeout(2000);
  const stats = await page.evaluate(() => ({
    sub: (document.getElementById('storageSub') || {}).textContent,
    rows: (document.getElementById('storageList') || {}).innerText.split('\n').join(' / '),
    cacheSub: (document.getElementById('cacheSub') || {}).textContent
  }));
  await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/r168-storage.png' });
  console.log(JSON.stringify({ probe, stats, errs }));
  await browser.close();
})();