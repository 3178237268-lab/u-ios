const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const p = await (await b.newContext({ viewport: { width: 430, height: 900 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + String(e).slice(0, 140)));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 140)); });
  p.on('response', r => { if (r.status() >= 400 && /\/api\/|\/media\//.test(r.url())) errs.push('HTTP ' + r.status() + ' ' + r.url().slice(0, 90)); });

  await p.addInitScript(() => localStorage.setItem('u-server', 'http://127.0.0.1:8787'));
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await wait(1800);
  await p.locator('#authUser').fill('bugb75145');
  await p.locator('#authPass').fill('pass1234');
  await p.locator('#authPass').press('Enter');
  await wait(3000);
  // 若没进主页，尝试点登录按钮
  if (await p.locator('#authUser').isVisible().catch(() => false)) {
    await p.locator('button:visible', { hasText: '登录' }).first().click().catch(() => {});
    await wait(2500);
  }
  const txts = await p.locator('.post:visible .ptext').allInnerTexts();
  console.log('B 看到帖子数 =', txts.length);
  console.log('文本 =', JSON.stringify(txts.slice(0, 8)));
  console.log('看到 A 的带图帖 =', txts.some(t => t.includes('带图测试帖')));
  const imgs = await p.locator('.post:visible img').evaluateAll(ns => ns.map(n => ({ src: (n.currentSrc || n.src || '').slice(0, 80), w: n.naturalWidth })));
  console.log('图片 =', JSON.stringify(imgs).slice(0, 500));
  console.log('视频数 =', await p.locator('.post:visible video').count());
  console.log('errors', errs.length); errs.slice(0, 8).forEach(e => console.log(' ', e));
  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\feed-b.png' });
  await b.close();
})();
