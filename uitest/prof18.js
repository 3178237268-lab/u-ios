const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
const BASE = 'http://127.0.0.1:8787';

(async () => {
  const u = 'prof' + Date.now().toString().slice(-6);
  const pass = 'pass1234';
  const r0 = await fetch(BASE + '/api/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: pass, nickname: u })
  });
  const reg = await r0.json();
  const tok = reg.token;
  // 上传一张图
  const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000002000000020806000000f4784b3b0000001649444154789c636060606064606060f80f0006000101a5f8f3d20000000049454e44ae426082', 'hex');
  const up = await fetch(BASE + '/api/media', {
    method: 'POST', headers: { 'Content-Type': 'image/png', Authorization: 'Bearer ' + tok, 'X-Filename': 'p.png' },
    body: png
  });
  const media = await up.json();
  const r1 = await fetch(BASE + '/api/posts', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
    body: JSON.stringify({ text: '我的18+帖 ' + u, sensitive: true, private: false, media: [media.id] })
  });
  const post = await r1.json();
  console.log('created post', post.id || JSON.stringify(post).slice(0, 120), 'media', media.id);

  const b = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader']
  });
  const ctx = await b.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + String(e).slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 160)); });

  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await wait(2200);
  await p.locator('#authUser').fill(u);
  await p.locator('#authPass').fill(pass);
  await p.locator('#authSubmit').click();
  await wait(2500);

  // 进入我的页面
  await p.evaluate(() => {
    const d = document.querySelector('#sideDrawer');
    if (d) d.classList.add('open');
    const b2 = document.querySelector('#sideBackdrop');
    if (b2) b2.classList.add('open');
  });
  await wait(600);
  await p.locator('#sideAvatar').click({ force: true }).catch(async () => {
    await p.locator('.side-item[data-side="profile"], [data-side="profile"]').first().click({ force: true });
  });
  await wait(2000);

  const vis = await p.evaluate(() => {
    const v = document.querySelector('#viewProfile');
    return {
      profileVisible: !!(v && v.classList.contains('on')),
      posts: document.querySelectorAll('#viewProfile .post').length,
      veil: document.querySelectorAll('#viewProfile .pveil').length,
      texts: Array.from(document.querySelectorAll('#viewProfile .post .ptext')).map(e => e.textContent.slice(0, 24))
    };
  });
  console.log('profile state', JSON.stringify(vis));

  const veilInfo = await p.evaluate(() => {
    const v = document.querySelector('#viewProfile .pveil');
    if (!v) return null;
    const btn = v.querySelector('.pveil-btn');
    const r = v.getBoundingClientRect();
    const br = btn ? btn.getBoundingClientRect() : null;
    return {
      cls: v.className,
      veilBox: [Math.round(r.width), Math.round(r.height)],
      btnText: btn ? btn.textContent : '',
      btnBox: br ? [Math.round(br.width), Math.round(br.height)] : null,
      btnAttrs: btn ? [btn.dataset.reveal || '', btn.dataset.hide || ''].join('|') : ''
    };
  });
  console.log('veil', JSON.stringify(veilInfo));

  // 点「显示」
  const clickedReveal = await p.evaluate(() => {
    const btn = document.querySelector('#viewProfile .pveil-btn');
    if (!btn) return 'no-btn';
    btn.click();
    return 'clicked';
  });
  await wait(900);
  const afterReveal = await p.evaluate(() => {
    const v = document.querySelector('#viewProfile .pveil');
    const btn = document.querySelector('#viewProfile .pveil-btn');
    return { cls: v ? v.className : null, text: btn ? btn.textContent : null, hide: btn ? btn.dataset.hide : null };
  });
  console.log('after reveal', JSON.stringify(afterReveal), clickedReveal);

  // 点帖子正文看是否打开详情
  await p.locator('#viewProfile .post .ptext').first().click();
  await wait(1200);
  const sheet = await p.evaluate(() => {
    const s = document.querySelector('#postSheet');
    return { open: !!(s && s.classList.contains('open')), text: (document.querySelector('#postBody') || {}).textContent ? document.querySelector('#postBody').textContent.slice(0, 30) : '' };
  });
  console.log('detail open?', JSON.stringify(sheet));
  console.log('errors', errs.length);
  errs.slice(0, 5).forEach(e => console.log('  ' + e));
  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\profile18.png' });
  await b.close();
})();
