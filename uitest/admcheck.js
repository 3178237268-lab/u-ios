/* 后台管理台 admin.html 自检（playwright-core + 本机 Chrome）
 * 说明：8787 上运行的进程服务的是另一份旧的 public 目录，
 * 因此 /admin.html 用本地编辑后的文件拦截注入；/api 一律走真实运行的服务。
 * Phase A：结构 + 真实后端能力探测；Phase B：mock role/views 字段验证渲染与交互。
 */
const fs = require('fs');
const { chromium } = require('playwright-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const LOCAL_HTML = 'D:\\deepseek\\gouzuoqu\\U\\server\\public\\admin.html';
const BASE = 'http://127.0.0.1:8787';
const CREDS = [
  ['admin', 'admin123'],
  ['admin', '123456'],
  ['admin123', 'admin123']
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message)));

  const html = fs.readFileSync(LOCAL_HTML, 'utf8');
  await page.route('**/admin.html*', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html })
  );

  const out = { creds: null, api: {}, tabs: {}, settings: {}, overview: {}, history: {}, posts: {}, mock: {}, errors: {} };

  await page.goto(BASE + '/admin.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
  const servedLen = await page.evaluate(() => document.documentElement.outerHTML.length);

  // ---------- 登录 ----------
  for (const [u, p] of CREDS) {
    await page.evaluate(() => document.getElementById('login').classList.remove('hide'));
    await page.fill('#lgUser', u);
    await page.fill('#lgPass', p);
    await page.click('#loginForm button[type=submit]');
    try {
      await page.waitForFunction(() => document.getElementById('login').classList.contains('hide'), null, { timeout: 4000 });
      out.creds = u + ' / ' + p;
      break;
    } catch (e) { await sleep(150); }
  }
  if (!out.creds) out.creds = 'FAILED: ' + (await page.textContent('#lgErr').catch(() => ''));
  log('[login]', out.creds, '| injected html chars =', html.length);

  // ---------- 真实后端能力 ----------
  out.api = await page.evaluate(async () => {
    const tk = localStorage.getItem('u-admin-token') || '';
    const get = async (u) => {
      const r = await fetch(u, { headers: { Authorization: 'Bearer ' + tk } });
      let j = null; try { j = await r.json(); } catch (e) {}
      return { status: r.status, json: j };
    };
    const first = (d, k) => (d && d[k] && d[k][0]) || null;
    const users = await get('/api/admin/users?q=');
    const posts = await get('/api/admin/posts?q=');
    const settings = await get('/api/admin/settings');
    const backups = await get('/api/admin/backups');
    const hist = await get('/api/admin/history?limit=1&offset=0');
    return {
      users: users.status, usersRole: first(users.json, 'users') ? first(users.json, 'users').role : undefined,
      posts: posts.status, postsViews: first(posts.json, 'posts') ? first(posts.json, 'posts').views : undefined,
      settings: settings.status,
      hasBotInterval: !!(settings.json && settings.json.settings && 'botIntervalSec' in settings.json.settings),
      hasMediaMax: !!(settings.json && settings.json.settings && 'mediaMaxPerPost' in settings.json.settings),
      backups: backups.status, backupsBody: backups.json,
      hist: hist.status, histTotal: hist.json && hist.json.total
    };
  });
  log('[api]', JSON.stringify(out.api));

  // ---------- 四个 tab：DOM 结构 ----------
  for (const tab of ['users', 'posts', 'comments', 'media']) {
    await page.click('.tab[data-tab="' + tab + '"]');
    await sleep(800);
    out.tabs[tab] = await page.evaluate((t) => {
      const view = document.getElementById('view-' + t);
      return {
        visible: view.style.display !== 'none',
        rows: view.querySelectorAll('tbody tr').length,
        chips: view.querySelectorAll('.role-chip').length
      };
    }, tab);
  }
  log('[tabs]', JSON.stringify(out.tabs));

  // ---------- 帖子表格结构 ----------
  out.posts = await page.evaluate(() => {
    const view = document.getElementById('view-posts');
    const heads = Array.from(view.querySelectorAll('thead th')).map((th) => th.textContent.trim());
    return {
      headers: heads, headerCount: heads.length,
      viewInputs: view.querySelectorAll('.view-input').length,
      saveBtn: !!view.querySelector('[data-viewssave]'),
      delBtn: !!view.querySelector('[data-postdel]'),
      bulkDel: !!document.getElementById('postBulkDel'),
      clearAll: !!document.getElementById('postClearAll'),
      checkAll: !!document.getElementById('postCheckAll')
    };
  });
  log('[posts]', JSON.stringify(out.posts));

  // ---------- 设置：新输入框 + 越界校验 ----------
  await page.click('.tab[data-tab="settings"]');
  await sleep(900);
  out.settings = await page.evaluate(() => {
    const pick = (id) => {
      const el = document.getElementById(id);
      if (!el) return { exists: false };
      const lab = el.closest('label');
      return {
        exists: true, value: el.value, min: el.min, max: el.max, type: el.type,
        label: lab ? lab.querySelector('span').textContent.trim() : null
      };
    };
    return { botInterval: pick('setBotInterval'), mediaMax: pick('setMediaMaxPerPost') };
  });
  log('[settings]', JSON.stringify(out.settings));

  out.settings.validation = await page.evaluate(async () => {
    const mm = document.getElementById('setMediaMaxPerPost');
    const iv = document.getElementById('setBotInterval');
    const res = {};
    if (mm) {
      const old = mm.value; mm.value = '99';
      document.getElementById('saveSettingsBtn').click();
      await new Promise((r) => setTimeout(r, 150));
      res.mediaMaxToast = document.getElementById('toast').textContent;
      mm.value = old;
    }
    if (iv) {
      const old = iv.value; iv.value = '0';
      document.getElementById('saveSettingsBtn').click();
      await new Promise((r) => setTimeout(r, 150));
      res.botIntervalToast = document.getElementById('toast').textContent;
      iv.value = old;
    }
    return res;
  });
  log('[settings.validation]', JSON.stringify(out.settings.validation));

  // ---------- 概览：备份区 ----------
  await page.click('.tab[data-tab="overview"]');
  await sleep(1200);
  out.overview = await page.evaluate(() => ({
    backupDir: document.getElementById('backupDir').textContent.trim(),
    rows: document.querySelectorAll('#backupList tr').length,
    firstRow: ((document.querySelector('#backupList tr') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
    emptyText: ((document.querySelector('#backupList .empty') || {}).textContent || '').trim(),
    backupBtn: !!document.getElementById('backupNowBtn'),
    reloadBtn: !!document.getElementById('backupReload')
  }));
  await page.click('#backupNowBtn');
  await sleep(350);
  out.overview.confirm = await page.evaluate(() => ({
    shown: document.getElementById('modal').classList.contains('show'),
    title: document.getElementById('modalTitle').textContent,
    text: document.getElementById('modalText').textContent
  }));
  await page.click('#modalCancel');
  await sleep(200);
  log('[overview]', JSON.stringify(out.overview));

  // ---------- 修改记录：清除按钮 ----------
  await page.click('.tab[data-tab="history"]');
  await sleep(900);
  out.history = await page.evaluate(() => ({
    clearBtn: !!document.getElementById('histClear'),
    clearLabel: ((document.getElementById('histClear') || {}).textContent || '').trim(),
    meta: document.getElementById('histMeta').textContent.trim(),
    rows: document.querySelectorAll('#histRows tr').length,
    noteAdd: !!document.getElementById('histNoteAdd')
  }));
  await page.click('#histClear');
  await sleep(700);
  out.history.confirm = await page.evaluate(() => ({
    shown: document.getElementById('modal').classList.contains('show'),
    title: document.getElementById('modalTitle').textContent,
    text: document.getElementById('modalText').textContent
  }));
  await page.click('#modalCancel');
  await sleep(200);
  log('[history]', JSON.stringify(out.history));

  // ================= Phase B：mock role / views 验证渲染 =================
  const ROLES = ['admin', 'bot', 'guest', 'user'];
  await page.route('**/api/admin/users?q=*', async (route) => {
    const r = await route.fetch(); const j = await r.json().catch(() => ({}));
    (j.users || []).forEach((u, i) => { u.role = ROLES[i % 4]; });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) });
  });
  await page.route('**/api/admin/posts?q=*', async (route) => {
    const r = await route.fetch(); const j = await r.json().catch(() => ({}));
    (j.posts || []).forEach((p, i) => { p.role = ROLES[i % 4]; p.views = 100 + i; });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) });
  });
  await page.route('**/api/admin/comments?q=*', async (route) => {
    const r = await route.fetch(); const j = await r.json().catch(() => ({}));
    (j.comments || []).forEach((c, i) => { c.role = ROLES[i % 4]; });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) });
  });
  await page.route('**/api/admin/media?q=*', async (route) => {
    const r = await route.fetch(); const j = await r.json().catch(() => ({}));
    (j.media || []).forEach((m, i) => { m.role = ROLES[i % 4]; });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) });
  });
  await page.route('**/api/admin/posts/*/views', async (route) => {
    const body = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, views: Number(body && body.views) }) });
  });

  for (const tab of ['users', 'posts', 'comments', 'media']) {
    await page.click('.tab[data-tab="' + tab + '"]');
    await sleep(900);
    out.mock[tab] = await page.evaluate((t) => {
      const view = document.getElementById('view-' + t);
      const chips = Array.from(view.querySelectorAll('.role-chip'));
      const kinds = {};
      chips.forEach((c) => {
        const k = Array.from(c.classList).find((x) => /^role-(admin|user|guest|bot)$/.test(x));
        kinds[k || '?'] = (kinds[k || '?'] || 0) + 1;
      });
      const cs = chips[0] ? getComputedStyle(chips[0]) : null;
      return {
        rows: view.querySelectorAll('tbody tr').length,
        chips: chips.length,
        kinds: kinds,
        sampleText: chips.map((c) => c.textContent).slice(0, 4),
        chipStyle: cs ? { radius: cs.borderRadius, size: cs.fontSize, pad: cs.padding, bg: cs.backgroundColor, color: cs.color } : null
      };
    }, tab);
    log('[mock.' + tab + ']', JSON.stringify(out.mock[tab]));
  }

  // 浏览量编辑：改第一个 input 后点保存
  out.mock.viewsEdit = await page.evaluate(async () => {
    const inp = document.querySelector('.view-input');
    const btn = document.querySelector('[data-viewssave]');
    if (!inp || !btn) return { ok: false, reason: 'no input/button' };
    const before = inp.value;
    inp.value = '4321';
    btn.click();
    await new Promise((r) => setTimeout(r, 700));
    return { ok: true, before: before, after: inp.value, toast: document.getElementById('toast').textContent };
  });
  log('[mock.viewsEdit]', JSON.stringify(out.mock.viewsEdit));

  await page.screenshot({ path: 'admcheck-posts.png', fullPage: false });
  await page.click('.tab[data-tab="overview"]');
  await sleep(900);
  await page.screenshot({ path: 'admcheck-overview.png', fullPage: false });

  out.errors.console = consoleErrors;
  out.errors.page = pageErrors;
  log('\n===== SUMMARY =====');
  log('served-html chars :', servedLen, '(intercepted local file)', html.length);
  log('console errors    :', consoleErrors.length, consoleErrors.slice(0, 8));
  log('page errors       :', pageErrors.length, pageErrors.slice(0, 8));

  fs.writeFileSync('admcheck-result.json', JSON.stringify(out, null, 2), 'utf8');
  await browser.close();
})().catch((e) => {
  console.error('FATAL', (e && e.stack) || e);
  process.exit(1);
});
