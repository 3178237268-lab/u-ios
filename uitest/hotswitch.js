const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 100)));

  // 1) 带着一个连不上的地址进入（模拟没找到服务器）
  await p.goto('http://127.0.0.1:8765/?srv=' + encodeURIComponent('http://127.0.0.1:9999'), { waitUntil: 'load' });
  await wait(1500);
  console.log('初始 srv =', await p.evaluate(() => localStorage.getItem('u-server')));
  console.log('__uSetServer 存在 =', await p.evaluate(() => typeof window.__uSetServer));

  // 2) 模拟原生后台重试找到服务器
  await p.evaluate(() => window.__uSetServer('http://127.0.0.1:8787'));
  await wait(1200);
  console.log('切换后 srv =', await p.evaluate(() => localStorage.getItem('u-server')));

  // 3) 游客登录看是否真的连上
  await p.locator('#guestBtn').click().catch(() => {});
  await wait(1600);
  console.log('posts =', await p.locator('.post:visible').count());
  console.log('srv 状态 =', (await p.evaluate(() => (document.querySelector('#srvStatus') || {}).textContent || '-')).slice(0, 70));
  console.log('errors', errs.length);
  await b.close();
})();
