const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
const BASE = 'http://127.0.0.1:8787';

(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await b.newContext({ viewport: { width: 430, height: 900 } });
  const p = await ctx.newPage();
  const net = [];
  p.on('response', async r => {
    const u = r.url();
    if (!u.includes('/api/')) return;
    let body = '';
    try { body = (await r.text()).slice(0, 150); } catch (e) {}
    if (r.request().method() !== 'GET') net.push(r.status() + ' ' + r.request().method() + ' ' + u.replace(BASE, '') + ' >> ' + body);
  });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + String(e).slice(0, 150)));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 150)); });

  await p.addInitScript(() => { localStorage.setItem('u-server', 'http://127.0.0.1:8787'); localStorage.removeItem('u-server-off'); });
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await wait(1600);

  const uname = 'poster' + (Date.now() % 100000);
  await p.locator('[data-auth-tab="register"]').click();
  await wait(500);
  await p.locator('#authUser').fill(uname);
  await p.locator('#authPass').fill('pass1234');
  await p.locator('#authPass').press('Enter');
  await wait(4500);
  const onAuth = await p.locator('#authScreen').evaluate(n => n.classList.contains('on')).catch(() => 'err');
  console.log('注册后 authScreen.on =', onAuth, '账号=', uname);

  await p.locator('#composeBtn').click({ timeout: 8000 });
  await wait(900);
  const txt = '别人看不到测试 ' + Date.now();
  await p.locator('#composeText').fill(txt);
  const priv = await p.locator('#privRow').evaluate(n => n.outerHTML.replace(/\s+/g, ' ').slice(0, 200)).catch(() => 'n/a');
  console.log('私密行 =', priv);
  await p.locator('#composePublish').click();
  await wait(4500);
  console.log('---- 写请求 ----');
  net.slice(-12).forEach(l => console.log('  ' + l));

  const r1 = await fetch(BASE + '/api/posts?limit=10').then(r => r.json());
  const posts = r1.posts || [];
  const found = posts.filter(x => (x.text || '').includes('别人看不到测试'));
  console.log('服务端找到该帖 =', found.length, JSON.stringify(found.map(x => ({ id: x.id, private: x.private, handle: x.author && x.author.handle, media: (x.media || []).length }))));
  console.log('服务端返回帖数 =', posts.length, ' 全 private 数 =', posts.filter(x => x.private).length);

  const ls = await p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = String(localStorage.getItem(k)).slice(0, 50); } return o; });
  console.log('页面 LS =', JSON.stringify(ls));
  const st = await p.evaluate(() => { try { return { me: (window.ME && window.ME.handle) || null, srv: window.SRV || null, posts: (window.state && window.state.posts || []).length }; } catch (e) { return String(e); } });
  console.log('页面状态 =', JSON.stringify(st));
  console.log('errors', errs.length); errs.slice(0, 6).forEach(e => console.log('  ' + e));
  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\post-flow.png' });
  await b.close();
})();
