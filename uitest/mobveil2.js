const { chromium, devices } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + String(e).slice(0, 140)));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 140)); });
  await p.addInitScript(() => { localStorage.setItem('u-server', 'http://127.0.0.1:8787'); localStorage.removeItem('u-server-off'); });
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await wait(1800);

  await p.locator('[data-auth-tab="register"]').click();
  await wait(400);
  await p.locator('#authUser').fill('mob2' + (Date.now() % 100000));
  await p.locator('#authPass').fill('pass1234');
  await p.locator('#authPass').press('Enter');
  await wait(4500);

  const card = p.locator('.post:visible').filter({ has: p.locator('.pveil') }).first();
  if (!(await card.count())) { console.log('没有 18+ 帖可测'); await b.close(); return; }

  const ok = [], fail = [];
  const step = async (n, f) => { try { await f(); ok.push(n); } catch (e) { fail.push(n + ' :: ' + e.message.split('\n')[0].slice(0, 70)); } };

  await step('点遮罩显示内容（不弹详情）', async () => {
    await card.locator('.pveil').first().tap({ position: { x: 30, y: 30 } });
    await wait(900);
    const opened = await p.locator('#postSheet').evaluate(n => n.classList.contains('open'));
    if (opened) throw new Error('遮罩点击弹出了详情');
    const cls = await card.locator('.pmedia').first().evaluate(n => n.className);
    if (cls.includes('private')) throw new Error('还没显示：' + cls);
  });

  await step('隐藏按钮够大（≥34px 高）', async () => {
    const box = await card.locator('.pveil-btn').first().evaluate(n => n.getBoundingClientRect().toJSON());
    if (box.height < 34 || box.width < 60) throw new Error(JSON.stringify(box));
    console.log('   隐藏按钮尺寸 =', Math.round(box.width) + 'x' + Math.round(box.height), ' 文案 =', await card.locator('.pveil-btn').first().innerText());
  });

  await step('点隐藏重新遮住', async () => {
    await card.locator('.pveil-btn').first().tap();
    await wait(900);
    const cls = await card.locator('.pmedia').first().evaluate(n => n.className);
    if (!cls.includes('private')) throw new Error('没重新模糊：' + cls);
    const txt = await card.locator('.pveil-btn').first().innerText();
    if (txt !== '显示') throw new Error('按钮文案=' + txt);
  });

  await step('再显示再隐藏（往返 3 次）', async () => {
    for (let i = 0; i < 3; i++) {
      await card.locator('.pveil').first().tap({ position: { x: 30, y: 30 } });
      await wait(600);
      await card.locator('.pveil-btn').first().tap();
      await wait(600);
    }
    const cls = await card.locator('.pmedia').first().evaluate(n => n.className);
    if (!cls.includes('private')) throw new Error('最后一轮没恢复遮罩');
  });

  await step('滚动后状态保留', async () => {
    await card.locator('.pveil').first().tap({ position: { x: 30, y: 30 } });
    await wait(600);
    await p.mouse.wheel(0, 400); await wait(700);
    await p.mouse.wheel(0, -400); await wait(700);
    const cls = await card.locator('.pmedia').first().evaluate(n => n.className);
    if (cls.includes('private')) throw new Error('滚动回来又被遮住了');
  });

  console.log('PASS ' + ok.length + '/' + (ok.length + fail.length));
  fail.forEach(f => console.log('FAIL ' + f));
  console.log('errors ' + errs.length); errs.slice(0, 5).forEach(e => console.log('  ' + e));
  await card.scrollIntoViewIfNeeded();
  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\mobile-hide.png' });
  await b.close();
})();
