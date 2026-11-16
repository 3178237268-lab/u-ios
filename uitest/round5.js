const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const p = await (await b.newContext({ viewport: { width: 430, height: 900 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + String(e).slice(0, 120)));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 120)); });
  p.on('response', r => { if (r.status() >= 500) errs.push('HTTP ' + r.status() + ' ' + r.url().slice(0, 80)); });
  const ok = [], fail = [];
  const step = async (n, f) => { try { await f(); ok.push(n); } catch (e) { fail.push(n + ' :: ' + e.message.split('\n')[0].slice(0, 80)); } };

  await p.addInitScript(() => localStorage.setItem('u-server', 'http://127.0.0.1:8787'));
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await wait(1500);

  await step('账号登录', async () => {
    await p.locator('#authUser').fill('bugb75145');
    await p.locator('#authPass').fill('pass1234');
    await p.locator('#authPass').press('Enter');
    await wait(3500);
    if (await p.locator('#authUser').isVisible().catch(() => false)) throw new Error('仍在登录页');
  });
  await step('首页看到别人的文字帖', async () => {
    const t = await p.locator('.post:visible .ptext').allInnerTexts();
    if (!t.some(x => x.includes('带图测试帖'))) throw new Error(JSON.stringify(t));
  });
  await step('首页看到别人的图片', async () => {
    const w = await p.locator('.post:visible img').evaluateAll(ns => ns.map(n => n.naturalWidth));
    if (!w.length || w.every(x => x === 0)) throw new Error('naturalWidth=' + JSON.stringify(w));
  });
  await step('首页看到别人的视频', async () => {
    const n = await p.locator('.post:visible video').count();
    if (!n) throw new Error('没有 video 元素');
  });
  await step('打开帖子详情', async () => {
    await p.locator('.post:visible .ptext', { hasText: '带图测试帖' }).first().click();
    await wait(1200);
    if (!(await p.locator('#postSheet').evaluate(n => n.classList.contains('open')).catch(() => false))) throw new Error('详情未打开');
  });
  await step('详情页有图', async () => {
    const w = await p.locator('#postSheet img').evaluateAll(ns => ns.map(n => n.naturalWidth));
    if (!w.length) throw new Error('详情无图');
  });
  await step('返回列表', async () => {
    await p.locator('#postBack').click(); await wait(800);
  });
  await step('点赞', async () => {
    await p.locator('.post:visible button[data-act="like"]').first().click({ timeout: 6000 });
    await wait(700);
  });
  await step('搜索页', async () => {
    await p.locator('.tab[data-tab="search"]').click(); await wait(900);
  });
  await step('搜索别人的帖', async () => {
    await p.locator('#searchInput').fill('带图');
    await wait(1500);
    const t = await p.locator('#viewSearch').innerText();
    if (!t.includes('带图测试帖')) throw new Error('搜索结果里没有');
  });
  await step('通知页', async () => { await p.locator('.tab[data-tab="notify"]').click(); await wait(800); });
  await step('私信页', async () => { await p.locator('.tab[data-tab="dm"]').click(); await wait(800); });
  await step('抽屉进我的主页', async () => {
    await p.locator('.tab[data-tab="feed"]').click(); await wait(600);
    await p.evaluate(() => { const d = document.getElementById('sideDrawer'); if (d) d.classList.add('open'); const bd = document.getElementById('sideBackdrop'); if (bd) bd.classList.add('open'); });
    await wait(400);
    await p.locator('#sideAvatar').click(); await wait(900);
    const vis = await p.locator('#viewProfile').isVisible();
    if (!vis) throw new Error('我的主页没打开');
  });
  await step('回到首页', async () => {
    await p.locator('.tab[data-tab="feed"]').click(); await wait(600);
  });

  console.log('PASS ' + ok.length + '/' + (ok.length + fail.length));
  fail.forEach(f => console.log('FAIL ' + f));
  console.log('errors ' + errs.length); errs.slice(0, 6).forEach(e => console.log('  ' + e));
  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\round5-final.png' });
  await b.close();
})();
