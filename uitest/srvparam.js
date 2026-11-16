const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + String(e).slice(0, 120)));
  p.on('console', m => { if (m.type() === 'error') errs.push('ERR ' + m.text().slice(0, 120)); });

  await p.goto('http://127.0.0.1:8765/?srv=' + encodeURIComponent('http://127.0.0.1:8787'), { waitUntil: 'load' });
  await p.waitForTimeout(1800);
  console.log('LS u-server =', await p.evaluate(() => localStorage.getItem('u-server')));
  console.log('splash gone =', await p.evaluate(() => !document.querySelector('.splash') || getComputedStyle(document.querySelector('.splash')).opacity === '0'));

  // 游客登录 + 时间线
  await p.locator('#guestBtn').click().catch(() => console.log('guestBtn 不可点'));
  await wait(1600);
  console.log('posts visible =', await p.locator('.post:visible').count());
  console.log('srv status text =', (await p.evaluate(() => (document.querySelector('#srvStatus') || {}).textContent || '(no node)')).slice(0, 60));

  // 无参数重新加载，验证地址被记住
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  console.log('reload LS =', await p.evaluate(() => localStorage.getItem('u-server')));
  console.log('errors', errs.length); errs.slice(0, 5).forEach(e => console.log(' ', e));
  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\srvparam.png' });
  await b.close();
})();
