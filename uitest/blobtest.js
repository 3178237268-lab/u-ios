const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const p = await (await b.newContext()).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + String(e).slice(0, 160)));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 160)); });
  // 精确复刻 dsh 交互预览：blob: URL + sandbox="allow-scripts"（不透明源）
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await p.evaluate(async () => {
    const txt = await (await fetch('/index.html')).text();
    const url = URL.createObjectURL(new Blob([txt], { type: 'text/html' }));
    const f = document.createElement('iframe');
    f.setAttribute('sandbox', 'allow-scripts');
    f.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:9999;background:#000';
    f.src = url;
    f.id = 'blobPreview';
    document.body.appendChild(f);
  });
  await wait(4000);
  const fr = p.frames().find(f => f.url().startsWith('blob:'));
  if (!fr) { console.log('NO BLOB FRAME'); await b.close(); return; }
  const st = await fr.evaluate(() => ({ splash: !!document.getElementById('splash'), booting: document.body.classList.contains('booting'), guest: !!document.getElementById('guestBtn'), posts: document.querySelectorAll('.post').length, origin: String(location.origin) }));
  console.log('blob frame state', JSON.stringify(st));
  const ok = [], fail = [];
  const step = async (n, fn) => { try { await fn(); ok.push(n); } catch (e) { fail.push(n + ' :: ' + e.message.split('\n')[0].slice(0, 70)); } };
  const V = s => fr.locator(s + ':visible');
  await step('游客登录', async () => { await V('#guestBtn').click({ timeout: 6000 }); await wait(2000); });
  await step('发帖', async () => { await V('#composeBtn').click({ timeout: 6000 }); await wait(800); await V('#composeText').fill('blob预览帖' + Date.now(), { timeout: 6000 }); await V('#composePublish').click({ timeout: 6000 }); await wait(2500); });
  await step('新帖可见', async () => { const t = await V('.post .ptext').first().innerText(); if (!t.includes('blob预览帖')) throw new Error('first=' + t.slice(0, 10)); });
  await step('点赞', async () => { await V('.post button[data-act="like"]').first().click({ timeout: 6000 }); await wait(900); });
  await step('详情+回复', async () => { await V('.post .ptext').first().click({ timeout: 6000 }); await wait(1000); await V('#replyInput').fill('blob回复', { timeout: 6000 }); await V('#replySend').click({ timeout: 6000 }); await wait(1200); await V('#postBack').click({ timeout: 6000 }); });
  await step('搜索', async () => { await V('.tab[data-tab="search"]').click({ timeout: 6000 }); await wait(600); await V('#searchInput').fill('U', { timeout: 6000 }); await wait(1200); });
  await step('设置+主题', async () => { await V('#settingsBtn').click({ timeout: 6000 }); await wait(700); await V('button[data-theme="light"]').click({ timeout: 6000 }); await wait(600); await V('button[data-theme="dark"]').click({ timeout: 6000 }); await wait(500); await V('#settingsClose').click({ timeout: 6000 }); });
  console.log('PASS ' + ok.length + '/' + (ok.length + fail.length)); fail.forEach(f => console.log('FAIL ' + f));
  console.log('errors', errs.length); errs.slice(0, 8).forEach(e => console.log('  ', e));
  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\blob-preview.png' });
  await b.close();
})();
