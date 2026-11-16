const { chromium, devices } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await b.newContext(Object.assign({}, devices['iPhone 13'], { defaultBrowserType: undefined }));
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + String(e).slice(0, 140)));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 140)); });
  await p.addInitScript(() => { localStorage.setItem('u-server', 'http://127.0.0.1:8787'); localStorage.removeItem('u-server-off'); });
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await wait(1800);

  await p.locator('[data-auth-tab="register"]').click();
  await wait(400);
  await p.locator('#authUser').fill('mob' + (Date.now() % 100000));
  await p.locator('#authPass').fill('pass1234');
  await p.locator('#authPass').press('Enter');
  await wait(4500);

  const card = p.locator('.post:visible').filter({ has: p.locator('.pveil') }).first();
  const cnt = await card.count();
  console.log('带遮罩的帖数量 =', cnt);
  if (!cnt) { console.log('没有可测的 18+ 帖'); await b.close(); return; }

  const btn = card.locator('.pveil-btn').first();
  console.log('初始按钮 =', JSON.stringify(await btn.evaluate(n => ({ txt: n.textContent, reveal: n.getAttribute('data-reveal'), hide: n.getAttribute('data-hide'), box: n.getBoundingClientRect().toJSON() }))));

  await btn.tap();
  await wait(1200);
  const after = await card.locator('.pveil-btn').first().evaluate(n => ({ txt: n.textContent, reveal: n.getAttribute('data-reveal'), hide: n.getAttribute('data-hide'), box: n.getBoundingClientRect().toJSON(), veilCls: n.closest('.pveil').className, mediaCls: n.closest('.pmedia').className }));
  console.log('点显示后 =', JSON.stringify(after));
  const revealed = await p.evaluate(() => JSON.stringify(window.state && window.state.revealed));
  console.log('state.revealed =', revealed);

  await card.locator('.pveil-btn').first().tap();
  await wait(1200);
  const back = await card.locator('.pveil-btn').first().evaluate(n => ({ txt: n.textContent, veilCls: n.closest('.pveil').className, mediaCls: n.closest('.pmedia').className }));
  console.log('点隐藏后 =', JSON.stringify(back));
  console.log('重新模糊 =', back.mediaCls.includes('private'));

  // 再试一次点遮罩空白区域（手机常见误触位置）
  await card.locator('.pveil').first().tap({ position: { x: 12, y: 12 } });
  await wait(800);
  console.log('点遮罩后 sheet 打开 =', await p.locator('#postSheet').evaluate(n => n.classList.contains('open')));
  console.log('errors', errs.length); errs.slice(0, 5).forEach(e => console.log('  ' + e));
  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\mobile-veil.png' });
  await b.close();
})();
