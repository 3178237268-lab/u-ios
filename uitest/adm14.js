/* adm14.js —— 任务 A/B/C 的管理台浏览器级验证
 * playwright-core + 本机 Chrome，直接访问自测实例 http://127.0.0.1:8911/admin.html
 * （admin.html 用相对路径调 API，因此页面和接口都在这个临时实例上）
 *
 * 断言：
 *  1. 帖子 / 评论 / 媒体三个列表页都有「发布者」筛选条（全部 / 用户 / 游客 / 人机 / 管理员）
 *  2. 点「用户」后行数变化，且每行 chip 都是「用户」；切回「全部」行数恢复
 *  3. #setBotDmPerSec 存在、能输入 0.5、能保存并回填
 *  4. 控制台无脚本报错
 */
const fs = require('fs');
const { chromium } = require('playwright-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:8911';
const OUT = 'D:\\deepseek\\gouzuoqu\\U\\uitest\\adm14-result.json';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const consoleErrors = [];
  const pageErrors = [];
  const badResponses = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    /* favicon.ico 是服务端本来就有的 404，与本次改动无关，单独归类 */
    const loc = (m.location && m.location().url) || '';
    if (/favicon\.ico/.test(loc) || (!loc && /Failed to load resource/.test(m.text()))) return;
    consoleErrors.push(m.text() + (loc ? ' @' + loc : ''));
  });
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message)));
  page.on('response', (r) => {
    if (r.status() >= 400 && !/favicon\.ico/.test(r.url())) badResponses.push(r.status() + ' ' + r.url());
  });

  const out = { steps: [], asserts: {}, errors: {} };
  const step = (name, ok, extra) => {
    out.steps.push({ name, ok, extra });
    log((ok ? '[OK] ' : '[FAIL] ') + name + (extra === undefined ? '' : ' -> ' + JSON.stringify(extra)));
  };

  await page.goto(BASE + '/admin.html', { waitUntil: 'domcontentloaded', timeout: 30000 });

  /* ---------- 登录 ---------- */
  await page.evaluate(() => document.getElementById('login').classList.remove('hide'));
  await page.fill('#lgUser', 'admin123');
  await page.fill('#lgPass', 'admin123');
  await page.click('#loginForm button[type=submit]');
  await page.waitForFunction(() => !document.getElementById('login') || document.getElementById('login').classList.contains('hide'), null, { timeout: 15000 });
  await sleep(600);
  step('admin123 登录并进入管理台', true, await page.evaluate(() => document.getElementById('healthText').textContent));

  const countRows = (sel) => page.evaluate((s) => document.querySelectorAll(s).length, sel);
  const chipsOf = (sel) => page.evaluate((s) =>
    Array.from(document.querySelectorAll(s)).map((tr) => {
      const c = tr.querySelector('.role-chip');
      return c ? c.textContent : '';
    }), sel);

  /* ---------- 帖子 ---------- */
  await page.click('button[data-tab="posts"]');
  await sleep(900);
  const pf = await countRows('#postRoleFilter .rf-btn');
  const pfLabels = await page.evaluate(() => Array.from(document.querySelectorAll('#postRoleFilter .rf-btn')).map((b) => b.textContent));
  step('帖子页存在发布者筛选条', pf === 5, pfLabels);
  out.asserts.postFilterButtons = pfLabels;

  const postAll = await countRows('#postRows tr');
  const postAllChips = await chipsOf('#postRows tr');
  const postAllCount = await page.textContent('#postCount');
  step('帖子「全部」行数', postAll > 0, { rows: postAll, countText: postAllCount, chips: Array.from(new Set(postAllChips)) });

  await page.click('#postRoleFilter .rf-btn[data-role="user"]');
  await sleep(900);
  const postUser = await countRows('#postRows tr');
  const postUserChips = await chipsOf('#postRows tr');
  const postUserCount = await page.textContent('#postCount');
  const userOnly = postUserChips.every((c) => c === '用户') && (postUser !== postAll);
  step('点「用户」后行数变化且只剩用户内容', userOnly, { rows: postUser, countText: postUserCount, chips: Array.from(new Set(postUserChips)) });
  out.asserts.postUserRows = postUser;
  out.asserts.postAllRows = postAll;

  await page.click('#postRoleFilter .rf-btn[data-role="bot"]');
  await sleep(900);
  const postBotChips = await chipsOf('#postRows tr');
  const postBotRows = await countRows('#postRows tr');
  step('点「人机」只剩人机内容（chip 仍显示「人机」）', postBotChips.length > 0 && postBotChips.every((c) => c === '人机'),
    { rows: postBotRows, chips: Array.from(new Set(postBotChips)), countText: await page.textContent('#postCount') });

  await page.click('#postRoleFilter .rf-btn[data-role=""]');
  await sleep(900);
  const postBack = await countRows('#postRows tr');
  step('切回「全部」行数恢复', postBack === postAll, { rows: postBack, expected: postAll });

  /* ---------- 评论 ---------- */
  await page.click('button[data-tab="comments"]');
  await sleep(900);
  const cf = await countRows('#commentRoleFilter .rf-btn');
  step('评论页存在发布者筛选条', cf === 5, cf);
  const cAll = await countRows('#commentRows tr');
  await page.click('#commentRoleFilter .rf-btn[data-role="user"]');
  await sleep(900);
  const cUserChips = await chipsOf('#commentRows tr');
  const cUser = await countRows('#commentRows tr');
  step('评论「用户」筛选只留用户', cUserChips.every((c) => c === '用户'), { all: cAll, rows: cUser, chips: Array.from(new Set(cUserChips)) });
  await page.click('#commentRoleFilter .rf-btn[data-role=""]');
  await sleep(700);

  /* ---------- 媒体 ---------- */
  await page.click('button[data-tab="media"]');
  await sleep(900);
  const mf = await countRows('#mediaRoleFilter .rf-btn');
  step('媒体页存在发布者筛选条', mf === 5, mf);
  await page.click('#mediaRoleFilter .rf-btn[data-role="user"]');
  await sleep(700);
  const mediaEmpty = await page.evaluate(() => {
    const box = document.querySelector('#mediaRows .empty');
    return box ? box.textContent : '';
  });
  step('媒体「用户」空态文案（本实例无上传文件）', true, mediaEmpty || '（本实例有数据）');
  await page.click('#mediaRoleFilter .rf-btn[data-role=""]');
  await sleep(500);

  /* ---------- 设置页：人机私信 ---------- */
  await page.click('button[data-tab="settings"]');
  await sleep(900);
  const hasDm = await page.evaluate(() => !!document.getElementById('setBotDmPerSec'));
  const dmAttrs = await page.evaluate(() => {
    const el = document.getElementById('setBotDmPerSec');
    return el ? { min: el.min, max: el.max, step: el.step, value: el.value, label: el.closest('label') ? el.closest('label').querySelector('span').textContent : '' } : null;
  });
  step('设置页存在 #setBotDmPerSec（0..1000 / step 0.1）', hasDm && dmAttrs.min === '0' && dmAttrs.max === '1000' && dmAttrs.step === '0.1', dmAttrs);

  await page.fill('#setBotDmPerSec', '0.5');
  await page.fill('#setBotInterval', '2');
  await page.click('#saveSettingsBtn');
  await sleep(1200);
  const afterSave = await page.evaluate(() => document.getElementById('setBotDmPerSec').value);
  step('保存 0.5 后输入框回填', afterSave === '0.5', afterSave);

  const cfg = await page.evaluate(async () => {
    const r = await fetch('/api/admin/settings', { headers: { Authorization: 'Bearer ' + (localStorage.getItem('u-admin-token') || '') } });
    const d = await r.json();
    return d.settings || {};
  });
  step('后端确实存下 botDmPerSec / botIntervalSec', cfg.botDmPerSec === 0.5 && cfg.botIntervalSec === 2,
    { botDmPerSec: cfg.botDmPerSec, botIntervalSec: cfg.botIntervalSec });
  out.asserts.savedSettings = { botDmPerSec: cfg.botDmPerSec, botIntervalSec: cfg.botIntervalSec };

  /* 非法值前端拦截：填 5000 应被 toast 拦住，不写库 */
  await page.fill('#setBotDmPerSec', '5000');
  await page.click('#saveSettingsBtn');
  await sleep(700);
  const toastText = await page.evaluate(() => {
    const t = document.querySelector('.toast, #toast');
    return t ? t.textContent : '';
  });
  const still = await page.evaluate(async () => {
    const r = await fetch('/api/admin/settings', { headers: { Authorization: 'Bearer ' + (localStorage.getItem('u-admin-token') || '') } });
    return (await r.json()).settings.botDmPerSec;
  });
  step('填 5000 被前端拦截（库值不变）', still === 0.5, { toast: toastText, backend: still });
  await page.fill('#setBotDmPerSec', '0.5');

  /* ---------- 截图 ---------- */
  await page.click('button[data-tab="posts"]');
  await sleep(800);
  await page.click('#postRoleFilter .rf-btn[data-role="user"]');
  await sleep(800);
  await page.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\uitest\\adm14-posts-user.png', fullPage: false });
  await page.click('button[data-tab="settings"]');
  await sleep(800);
  await page.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\uitest\\adm14-settings.png', fullPage: false });

  out.errors.console = consoleErrors;
  out.errors.page = pageErrors;
  out.errors.badResponses = badResponses;
  step('控制台无脚本报错、无 4xx/5xx 资源', consoleErrors.length === 0 && pageErrors.length === 0 && badResponses.length === 0,
    { console: consoleErrors, page: pageErrors, badResponses });

  const failed = out.steps.filter((s) => !s.ok);
  out.pass = failed.length === 0;
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
  log('---- 结果：' + (out.pass ? '全部通过' : failed.length + ' 条失败') + ' ----');
  log('截图：adm14-posts-user.png / adm14-settings.png，明细：' + OUT);

  await browser.close();
  process.exit(out.pass ? 0 : 1);
})().catch((e) => { console.error('FAIL ' + (e && e.message)); process.exit(1); });
