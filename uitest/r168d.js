const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 412, height: 900 }, hasTouch: true, isMobile: true });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => {
    const items = [
      { p: 'n:/data/user/0/com.trae.u/cache/webview/x.jpg', n: 'webview_x.jpg', s: 204800, t: 'image', w: 'app' },
      { p: 'n:/data/user/0/com.trae.u/cache/tw/a.mp4', n: 'tw_a.mp4', s: 3145728, t: 'video', w: 'app' },
      { p: 'c:content://media/external/downloads/9991', n: 'U-2.22.apk', s: 1373901, t: 'other', w: 'download' }
    ];
    window.__del = [];
    window.UHost = {
      cacheScan: function () { return JSON.stringify({ bytes: 4754429, count: 3, items: items }); },
      cacheDelete: function (p) { window.__del.push(p); return '{"ok":2,"fail":0}'; },
      listApks: function () { return '[]'; }
    };
  });
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1100);
  await page.fill('#authUser', 'nlg65268'); await page.fill('#authPass', 'pass12345'); await page.click('#authSubmit');
  await page.waitForTimeout(2600);
  await page.evaluate(() => { document.getElementById('settingsSheet').classList.add('open'); document.body.classList.add('auth-settings'); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { const r = [...document.querySelectorAll('.set-row')].find(x => (x.textContent || '').indexOf('数据文件') >= 0); if (r) r.click(); });
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.getElementById('storageOpen').click());
  await page.waitForTimeout(1200);
  const out = await page.evaluate(async () => {
    const rows = [...document.querySelectorAll('#cacheList .cache-row')];
    rows.forEach((r, i) => { if (r.innerText.indexOf('App 缓存目录') >= 0) { const cb = r.querySelector('input[data-cid]'); cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); } });
    await new Promise(r => setTimeout(r, 200));
    const delBtn = document.getElementById('cacheDel');
    const disabledBefore = delBtn.disabled;
    delBtn.click();
    await new Promise(r => setTimeout(r, 500));
    const open = document.getElementById('confirmWrap').classList.contains('open');
    const okBtn = document.getElementById('confirmOk');
    const okText = okBtn ? okBtn.textContent : '';
    if (open && okBtn) okBtn.click();
    await new Promise(r => setTimeout(r, 1500));
    return { disabledBefore, dialogOpen: open, okText, del: window.__del, toast: (document.getElementById('toast') || {}).textContent, cacheSub: (document.getElementById('cacheSub') || {}).textContent, rowsLeft: document.querySelectorAll('#cacheList .cache-row').length };
  });
  console.log(JSON.stringify({ out, errs }, null, 0));
  await browser.close();
})();