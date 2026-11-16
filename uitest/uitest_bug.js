'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
const log = [];
const errs = [];
const shotDir = 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots';
fs.mkdirSync(shotDir, { recursive: true });

function note(name, ok, detail) {
  log.push({ name, ok, detail });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : ''));
}
const vis = (p, sel) => p.locator(sel + ':visible');

(async () => {
  const b = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'zh-CN' });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('u-server', 'http://127.0.0.1:8899'); } catch (e) {}
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('console', (m) => {
    if (m.type() === 'error') {
      const l = m.location();
      errs.push('console: ' + m.text().slice(0, 200) + ' @ ' + ((l && l.url) || ''));
    }
  });
  p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url().slice(0, 120)));
  p.on('response', (r) => { if (r.status() >= 400) errs.push('http' + r.status() + ': ' + r.url().slice(0, 140)); });

  await p.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: shotDir + '/01-auth.png' });
  note('首屏渲染出登录页', await p.isVisible('#guestBtn'));

  await p.click('#guestBtn');
  await p.waitForTimeout(2800);
  note('游客登录后有时间线帖子', (await vis(p, '.post').count()) > 0, 'posts=' + (await vis(p, '.post').count()));
  await p.screenshot({ path: shotDir + '/02-feed.png' });

  /* 发帖 */
  await p.click('#composeBtn');
  await p.waitForTimeout(600);
  const txt = '自动化测试帖' + Date.now();
  await p.fill('#composeText', txt);
  await p.waitForTimeout(300);
  await p.click('#composePublish');
  await p.waitForTimeout(2600);
  note('发帖后新帖出现在时间线', (await p.locator('.post:visible', { hasText: txt }).count()) > 0);
  await p.screenshot({ path: shotDir + '/03-posted.png' });

  /* 点赞 */
  const likeBtn = vis(p, '.post').first().locator('button[data-act="like"]');
  const before = (await likeBtn.innerText()).trim();
  await likeBtn.click();
  await p.waitForTimeout(900);
  const after = (await likeBtn.innerText()).trim();
  note('点赞数字变化', before !== after, before + ' -> ' + after);

  /* tab */
  for (const t of ['search', 'notify', 'profile', 'feed']) {
    await p.click('.tab[data-tab="' + t + '"]');
    await p.waitForTimeout(700);
    const on = await p.locator('.tab[data-tab="' + t + '"]').evaluate((el) => el.classList.contains('on')).catch(() => false);
    note('切到 ' + t + ' tab', on === true);
  }
  await p.screenshot({ path: shotDir + '/04-feed.png' });

  /* 搜索 */
  await p.click('.tab[data-tab="search"]');
  await p.waitForTimeout(500);
  await p.fill('#searchInput', '带图帖');
  await p.waitForTimeout(2000);
  note('搜索出结果', (await vis(p, '.post').count()) > 0, 'hits=' + (await vis(p, '.post').count()));
  await p.screenshot({ path: shotDir + '/05-search.png' });

  /* 设置 + 深色 */
  await p.click('.tab[data-tab="profile"]');
  await p.waitForTimeout(800);
  await p.click('#settingsBtn');
  await p.waitForTimeout(700);
  await p.screenshot({ path: shotDir + '/06-settings.png' });
  const darkBtn = p.locator('button[data-theme="dark"]');
  if (await darkBtn.count()) {
    await darkBtn.click();
    await p.waitForTimeout(900);
    const isDark = await p.evaluate(() => !document.body.classList.contains('light') && localStorage.getItem('u-theme') === 'dark');
    note('切换深色模式生效', isDark === true);
    await p.screenshot({ path: shotDir + '/07-dark.png' });
    await p.click('button[data-theme="light"]');
    await p.waitForTimeout(800);
    const isLight = await p.evaluate(() => document.body.classList.contains('light') && localStorage.getItem('u-theme') === 'light');
    note('切换浅色模式生效', isLight === true);
    await p.screenshot({ path: shotDir + '/07-light.png' });
    await p.click('button[data-theme="dark"]');
    await p.waitForTimeout(600);
  } else {
    note('设置里有主题开关', false);
  }
  await p.click('#settingsClose').catch(() => {});
  await p.waitForTimeout(500);

  /* 帖子详情 + 回复 */
  await p.click('.tab[data-tab="feed"]');
  await p.waitForTimeout(900);
  const firstPost = vis(p, '.post').first();
  if (await firstPost.count()) {
    await firstPost.locator('.ptext').first().click({ force: true }).catch(() => {});
    await p.waitForTimeout(1100);
    note('打开帖子详情', (await p.locator('#postBack:visible').count()) > 0);
    await p.screenshot({ path: shotDir + '/08-detail.png' });
    const box = p.locator('#replyInput:visible').first();
    if (await box.count()) {
      await box.fill('自动化评论');
      await p.click('#replySend');
      await p.waitForTimeout(1600);
      note('发表回复成功', (await p.locator('text=自动化评论').count()) > 0);
    } else {
      note('详情页有回复输入框', false);
    }
    await p.click('#postBack');
    await p.waitForTimeout(700);
  }

  /* 私密帖：发布时勾选私密 */
  await p.click('#composeBtn');
  await p.waitForTimeout(600);
  const privTxt = '私密自动化' + Date.now();
  await p.fill('#composeText', privTxt);
  const priv = p.locator('#privRow');
  if (await priv.count()) {
    await priv.click();
    await p.waitForTimeout(300);
    await p.click('#composePublish');
    await p.waitForTimeout(2200);
    note('私密帖发布成功', (await p.locator('.post:visible', { hasText: privTxt }).count()) > 0);
  } else {
    note('发帖面板有私密开关', false);
    await p.click('#composeClose').catch(() => {});
  }
  await p.screenshot({ path: shotDir + '/11-private.png' });

  /* 通知 */
  await p.click('.tab[data-tab="notify"]');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: shotDir + '/09-notify.png' });

  /* 刷新保持登录 */
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2800);
  note('刷新后保持登录态', (await vis(p, '.post').count()) > 0 || (await p.isVisible('#composeBtn')));
  await p.screenshot({ path: shotDir + '/10-reload.png' });

  fs.writeFileSync('D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\uitest-result.json', JSON.stringify({ log, errs }, null, 2));
  console.log('\n==== UI 失败 ' + log.filter((x) => !x.ok).length + ' / ' + log.length + ' ====');
  console.log('==== 网络/控制台异常 ' + errs.length + ' 条 ====');
  [...new Set(errs)].slice(0, 40).forEach((e) => console.log('  ! ' + e));
  await b.close();
})().catch((e) => { console.error('脚本异常 ' + e.message); process.exit(1); });
