const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
const BASE = 'http://127.0.0.1:8787';
const APP = 'http://127.0.0.1:8765/';

(async () => {
  const u = 'dg2' + Date.now().toString().slice(-6);
  const pw = 'pass1234';
  const reg = await (await fetch(BASE + '/api/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: pw, nickname: u })
  })).json();
  const tok = reg.token;
  const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000002000000020806000000f4784b3b0000001649444154789c636060606064606060f80f0006000101a5f8f3d20000000049454e44ae426082', 'hex');
  const media = await (await fetch(BASE + '/api/media', {
    method: 'POST', headers: { 'Content-Type': 'image/png', Authorization: 'Bearer ' + tok, 'X-Filename': 'p.png' }, body: png
  })).json();
  const post = await (await fetch(BASE + '/api/posts', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
    body: JSON.stringify({ text: 'diag2 ' + u, sensitive: true, media: [media.id] })
  })).json();
  const pid = post.post.id;
  console.log('pid', pid);

  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await b.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
  const p = await ctx.newPage();
  p.on('console', m => console.log('[' + m.type() + '] ' + m.text().slice(0, 160)));
  p.on('pageerror', e => console.log('PAGEERR ' + String(e).slice(0, 200)));
  await p.goto(APP, { waitUntil: 'load' });
  await wait(2200);
  await p.locator('#authUser').fill(u);
  await p.locator('#authPass').fill(pw);
  await p.locator('#authSubmit').click();
  await wait(2600);
  await p.evaluate(() => {
    window.__clicks = [];
    document.addEventListener('click', function (e) {
      window.__clicks.push(e.target.tagName + '.' + (e.target.className || '') + ' reveal=' + (e.target.dataset ? e.target.dataset.reveal : ''));
    }, true);
    document.querySelector('#sideDrawer').classList.add('open');
    document.querySelector('#sideBackdrop').classList.add('open');
  });
  await wait(400);
  await p.locator('#sideAvatar').click({ force: true });
  await wait(1800);

  // 用真实鼠标点击按钮中心
  const box = await p.evaluate((id) => {
    const art = document.querySelector(`#viewProfile .post[data-id="srv_${id}"]`);
    if (!art) return null;
    art.scrollIntoView({ block: 'center' });
    const btn = art.querySelector('.pveil-btn');
    const r = btn.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      btn: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      topEl: el ? el.tagName + '.' + el.className : null
    };
  }, pid);
  console.log('box', JSON.stringify(box));
  if (!box) { await b.close(); return; }

  await p.mouse.click(box.btn[0] + box.btn[2] / 2, box.btn[1] + box.btn[3] / 2 - 0);
  await wait(300);
  const s1 = await p.evaluate((id) => {
    const art = document.querySelector(`#viewProfile .post[data-id="srv_${id}"]`);
    return { cls: art.querySelector('.pveil').className, label: art.querySelector('.pveil-btn').textContent.trim(), clicks: window.__clicks.slice(-4) };
  }, pid);
  console.log('after real click 300ms', JSON.stringify(s1));
  await wait(1500);
  const s2 = await p.evaluate((id) => {
    const art = document.querySelector(`#viewProfile .post[data-id="srv_${id}"]`);
    return { cls: art.querySelector('.pveil').className, label: art.querySelector('.pveil-btn').textContent.trim() };
  }, pid);
  console.log('after 1800ms', JSON.stringify(s2));
  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\diag-reveal.png' });
  await b.close();
})();
