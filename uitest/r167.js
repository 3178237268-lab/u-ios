const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 412, height: 900 }, hasTouch: true, isMobile: true });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  // 注册+登录
  const uname = 'cache' + Date.now().toString().slice(-6);
  await page.evaluate(async (u) => {
    await fetch('http://127.0.0.1:8787/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: 'pass12345', nickname: '缓存测试' }) });
  }, uname);
  await page.fill('#authUser', uname); await page.fill('#authPass', 'pass12345'); await page.click('#authSubmit');
  await page.waitForTimeout(2500);
  // 直接往 IndexedDB 写一条带 blob 的帖子(模拟本机发帖)
  const put = await page.evaluate(async () => {
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const bin = atob(png); const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const blob = new Blob([arr], { type: 'image/png' });
    const db = await new Promise((res, rej) => { const r = indexedDB.open('u-app-db', 2); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const post = { id: 'clstest' + Date.now(), author: { key: 'me', name: '我', handle: 'me' }, text: 'cache test', createdAt: Date.now(),
      media: [{ id: 'mtest1', type: 'image', name: 'test.png', blob: blob }], likes: 0, reposts: 0, replies: 0, views: 1 };
    await new Promise((res, rej) => { const tx = db.transaction('posts', 'readwrite'); tx.objectStore('posts').put(post); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    return true;
  });
  await page.waitForTimeout(300);
  // 打开 设置->数据文件
  await page.evaluate(() => { document.getElementById('settingsSheet').classList.add('open'); document.body.classList.add('auth-settings'); });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('.set-row')].find(r => (r.textContent || '').indexOf('数据文件') >= 0);
    if (row) row.click();
  });
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => ({
    sub: (document.getElementById('storageSub') || {}).textContent,
    rows: (document.getElementById('storageList') || {}).innerText,
    cacheSub: (document.getElementById('cacheSub') || {}).textContent,
    sheetOpen: document.getElementById('dataSheet').classList.contains('open')
  }));
  await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/r167-before.png' });
  console.log(JSON.stringify({ put, info, errs }));
  await browser.close();
})();