const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const p = await (await b.newContext({ viewport: { width: 430, height: 900 } })).newPage();
  const bad = [];
  p.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url().slice(0, 90)); });
  p.on('pageerror', e => bad.push('PAGEERR ' + String(e).slice(0, 100)));
  await p.addInitScript(() => localStorage.setItem('u-server', 'http://127.0.0.1:8787'));
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await wait(1500);
  await p.locator('#authUser').fill('bugb75145');
  await p.locator('#authPass').fill('pass1234');
  await p.locator('#authPass').press('Enter');
  await wait(4000);

  const txts = await p.locator('.post:visible .ptext').allInnerTexts();
  const imgs = await p.locator('.post:visible img').evaluateAll(ns => ns.map(n => ({ src: (n.currentSrc || n.src || '').slice(-24), w: n.naturalWidth })));
  console.log('首页可见帖子 =', JSON.stringify(txts));
  console.log('首页图片 =', JSON.stringify(imgs));
  console.log('看到别人内容 =', txts.some(t => t.includes('带图测试帖')));
  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\feed-fixed.png' });
  console.log('errors', JSON.stringify(bad.slice(0, 5)));
  await b.close();
})();
