const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await b.newContext({ viewport: { width: 430, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + String(e).slice(0, 140)));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 140)); });
  p.on('response', r => { if (r.status() >= 500) errs.push('HTTP' + r.status() + ' ' + r.url().slice(-40)); });

  const ok = [], fail = [];
  const step = async (n, f) => { try { await f(); ok.push(n); } catch (e) { fail.push(n + ' :: ' + e.message.split('\n')[0].slice(0, 70)); } };

  await p.addInitScript(() => { localStorage.setItem('u-server', 'http://127.0.0.1:8787'); localStorage.removeItem('u-server-off'); });
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await wait(1600);

  await step('注册新账号', async () => {
    await p.locator('[data-auth-tab="register"]').click();
    await wait(400);
    await p.locator('#authUser').fill('reg' + (Date.now() % 100000));
    await p.locator('#authPass').fill('pass1234');
    await p.locator('#authPass').press('Enter');
    await wait(4500);
    if (await p.locator('#authScreen').evaluate(n => n.classList.contains('on'))) throw new Error('仍在登录页');
  });

  await step('首页看到别人的文字帖', async () => {
    const t = await p.locator('.post:visible .ptext').allInnerTexts();
    if (!t.some(x => x.trim().length > 1)) throw new Error(JSON.stringify(t.slice(0, 5)));
  });

  await step('18+ 帖显示遮罩', async () => {
    const n = await p.locator('.post:visible .pveil').count();
    if (!n) throw new Error('没有遮罩');
  });

  await step('点显示后图片出现', async () => {
    const card = p.locator('.post:visible').filter({ has: p.locator('.pveil') }).first();
    const isVideo = await card.locator('.pmedia video').count();
    await card.locator('.pveil-btn').click({ timeout: 8000 });
    await wait(1500);
    const cls = await card.locator('.pmedia').first().evaluate(n => n.className);
    if (cls.includes('private')) throw new Error('遮罩没撤: ' + cls);
    if (isVideo) {
      const n = await card.locator('.pmedia video').count();
      if (!n) throw new Error('视频没了');
      return;
    }
    const w = await card.locator('img').evaluateAll(ns => ns.map(n => n.naturalWidth));
    if (!w.some(x => x > 0)) throw new Error('naturalWidth=' + JSON.stringify(w));
  });

  await step('首页看到视频', async () => {
    const n = await p.locator('.post:visible video').count();
    if (!n) throw new Error('没有 video');
  });

  await step('打开帖子详情', async () => {
    await p.locator('.post:visible .ptext').first().click();
    await wait(1300);
    if (!(await p.locator('#postSheet').evaluate(n => n.classList.contains('open')))) throw new Error('没打开');
  });

  await step('返回列表', async () => { await p.locator('#postBack').click(); await wait(800); });

  await step('点赞', async () => {
    await p.locator('.post:visible button[data-act="like"]').first().click({ timeout: 8000 });
    await wait(700);
  });

  await step('发一条自己的帖', async () => {
    await p.locator('#composeBtn').click(); await wait(800);
    await p.locator('#composeText').fill('回归帖 ' + Date.now());
    await p.locator('#composePublish').click(); await wait(3500);
  });

  await step('搜索页', async () => { await p.locator('.tab[data-tab="search"]').click(); await wait(900); });
  await step('通知页', async () => { await p.locator('.tab[data-tab="notify"]').click(); await wait(800); });
  await step('私信页', async () => { await p.locator('.tab[data-tab="dm"]').click(); await wait(800); });
  await step('抽屉进我的主页', async () => {
    await p.locator('.tab[data-tab="feed"]').click(); await wait(500);
    await p.evaluate(() => { document.getElementById('sideDrawer').classList.add('open'); document.getElementById('sideBackdrop').classList.add('open'); });
    await wait(400);
    await p.locator('#sideAvatar').click(); await wait(900);
    if (!(await p.locator('#viewProfile').isVisible())) throw new Error('没进主页');
  });
  await step('回到首页', async () => { await p.locator('.tab[data-tab="feed"]').click(); await wait(600); });

  console.log('PASS ' + ok.length + '/' + (ok.length + fail.length));
  fail.forEach(f => console.log('FAIL ' + f));
  console.log('errors ' + errs.length); errs.slice(0, 6).forEach(e => console.log('  ' + e));
  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\round6.png' });
  await b.close();
})();
