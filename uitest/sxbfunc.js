const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const p = await (await b.newContext()).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + String(e).slice(0, 140)));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 140)); });
  await p.goto('http://127.0.0.1:8765/.tmp-test/preview-sandbox.html', { waitUntil: 'load' });
  await p.waitForTimeout(2500);
  const fr = p.frames().find(f => f.url().includes('index.html'));
  const ok = [], fail = [];
  const step = async (name, fn) => { try { await fn(); ok.push(name); } catch (e) { fail.push(name + ' :: ' + e.message.split('\n')[0].slice(0, 90)); } };

  await step('游客登录', async () => { await fr.locator('#guestBtn').click(); await wait(1200); });
  await step('进到时间线', async () => { const n = await fr.locator('.post').count(); if (n < 1) throw new Error('posts=' + n); });
  await step('打开发帖', async () => { await fr.locator('#composeBtn').click(); await wait(600); });
  await step('写内容并发布', async () => { await fr.locator('#composeText').fill('沙箱环境测试帖 ' + Date.now()); await fr.locator('#composePublish').click(); await wait(1500); });
  await step('新帖出现在时间线', async () => { const t = await fr.locator('.post .ptext').first().innerText(); if (!t.includes('沙箱环境测试帖')) throw new Error('first=' + t.slice(0, 20)); });
  await step('点赞', async () => { await fr.locator('.post button[data-act="like"]').first().click(); await wait(800); });
  await step('打开帖子详情', async () => { await fr.locator('.post .ptext').first().click(); await wait(900); });
  await step('发回复', async () => { await fr.locator('#replyInput').fill('沙箱回复'); await fr.locator('#replySend').click(); await wait(1200); });
  await step('关闭详情', async () => { await fr.locator('#postBack').click(); await wait(700); });
  await step('切搜索', async () => { await fr.locator('.tab[data-tab="search"]').click(); await wait(600); });
  await step('搜索有结果', async () => { await fr.locator('#searchInput').fill('U'); await wait(1200); const n = await fr.locator('.post').count(); if (n < 1) throw new Error('hits=' + n); });
  await step('切通知', async () => { await fr.locator('.tab[data-tab="notify"]').click(); await wait(600); });
  await step('切我的', async () => { await fr.locator('.tab[data-tab="profile"]').click(); await wait(600); });
  await step('切回首页', async () => { await fr.locator('.tab[data-tab="feed"]').click(); await wait(600); });
  await step('打开设置', async () => { await fr.locator('#settingsBtn').click(); await wait(700); });
  await step('切换浅色', async () => { await fr.locator('button[data-theme="light"]').click(); await wait(600); const light = await fr.evaluate(() => document.body.classList.contains('light')); if (!light) throw new Error('未切到浅色'); });
  await step('关闭设置', async () => { await fr.locator('#settingsClose').click(); await wait(500); });

  console.log('PASS ' + ok.length + ' / ' + (ok.length + fail.length));
  fail.forEach(f => console.log('FAIL ' + f));
  console.log('errors', errs.length); errs.slice(0, 8).forEach(e => console.log(' ', e));
  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\sxb-final.png' });
  await b.close();
})();
