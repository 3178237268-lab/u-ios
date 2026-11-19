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
    window.__del = [];
    window.__scanCount = 0;
    window.UHost = {
      cacheScan: function () { window.__scanCount++; return JSON.stringify({ bytes: 9965829, count: 4, items: items }); },
      cacheDelete: function (p) { window.__del.push(p); return '{"ok":1,"fail":0}'; },
      listApks: function () { return '[]'; }
    };
  });
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1100);
  await page.fill('#authUser', 'nl246961'); await page.fill('#authPass', 'pass12345'); await page.click('#authSubmit');
  await page.waitForTimeout(2600);
  await page.evaluate(() => { document.getElementById('settingsSheet').classList.add('open'); document.body.classList.add('auth-settings'); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { const r = [...document.querySelectorAll('.set-row')].find(x => (x.textContent || '').indexOf('数据文件') >= 0); if (r) r.click(); });
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.getElementById('storageOpen').click());
  await page.waitForTimeout(1200);
  const list = await page.evaluate(() => [...document.querySelectorAll('#cacheList .cache-row')].map(r => r.innerText.replace(/\n/g, ' | ')));
  await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/r168-cachelist.png' });
  const del = await page.evaluate(async () => {
    const rows = [...document.querySelectorAll('#cacheList .cache-row')];
    const idx = rows.findIndex(r => r.innerText.indexOf('App 缓存目录') >= 0);
    const cb = rows[idx].querySelector('input[data-cid]');
    cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('cacheDel').click();
    await new Promise(r => setTimeout(r, 400));
    const ok = document.querySelector('#modalOk'); if (ok) ok.click();
    await new Promise(r => setTimeout(r, 1200));
    return { pickedIdx: idx, del: window.__del, toast: (document.getElementById('toast') || {}).textContent };
  });
  console.log(JSON.stringify({ list, del, errs }));
  await browser.close();
})();