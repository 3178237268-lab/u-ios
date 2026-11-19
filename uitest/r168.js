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
    const bytes = items.reduce((a, b) => a + b.s, 0);
    window.__delCalls = [];
    window.UHost = {
      cacheScan: function () { return JSON.stringify({ bytes: bytes, count: items.length, items: items }); },
      cacheDelete: function (p) { window.__delCalls.push(p); return '{"ok":1,"fail":0}'; },
      listApks: function () { return '[]'; }
    };
  });
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const uname = 'nc140064';
  await page.fill('#authUser', uname); await page.fill('#authPass', 'pass12345'); await page.click('#authSubmit');
  await page.waitForTimeout(2500);
  await page.evaluate(() => { document.getElementById('settingsSheet').classList.add('open'); document.body.classList.add('auth-settings'); });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('.set-row')].find(r => (r.textContent || '').indexOf('数据文件') >= 0);
    if (row) row.click();
  });
  await page.waitForTimeout(1800);
  const stats = await page.evaluate(() => ({
    sub: (document.getElementById('storageSub') || {}).textContent,
    rows: (document.getElementById('storageList') || {}).innerText.split('\n').join(' / '),
    cacheSub: (document.getElementById('cacheSub') || {}).textContent
  }));
  await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/r168-storage.png' });
  // 打开本地缓存文件列表
  await page.evaluate(() => document.getElementById('storageOpen').click());
  await page.waitForTimeout(1200);
  const list = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#cacheList .cache-row')];
    return { n: rows.length, texts: rows.map(r => r.innerText.replace(/\n/g, ' | ')) };
  });
  await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/r168-cachelist.png' });
  // 勾选第一项并删除
  const del = await page.evaluate(async () => {
    const cb = document.querySelector('#cacheList input[data-cid]');
    cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('cacheDel').click();
    await new Promise(r => setTimeout(r, 300));
    const ok = document.querySelector('#modalOk');
    if (ok) ok.click();
    await new Promise(r => setTimeout(r, 800));
    return { delCalls: window.__delCalls, sel: (document.getElementById('cacheSelInfo') || {}).textContent };
  });
  console.log(JSON.stringify({ stats, list, del, errs }));
  await browser.close();
})();