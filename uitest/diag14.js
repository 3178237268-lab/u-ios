const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
const BASE = 'http://127.0.0.1:8787';
const APP = 'http://127.0.0.1:8765/';

(async () => {
  const u = 'dg' + Date.now().toString().slice(-6);
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
    body: JSON.stringify({ text: 'diag ' + u, sensitive: true, media: [media.id] })
  })).json();
  const pid = post.post.id;

  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await b.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ' + m.text().slice(0, 200)); });
  p.on('pageerror', e => console.log('PAGEERR ' + String(e).slice(0, 200)));
  await p.goto(APP, { waitUntil: 'load' });
  await wait(2200);
  await p.locator('#authUser').fill(u);
  await p.locator('#authPass').fill(pw);
  await p.locator('#authSubmit').click();
  await wait(2600);
  await p.evaluate(() => {
    document.querySelector('#sideDrawer').classList.add('open');
    document.querySelector('#sideBackdrop').classList.add('open');
  });
  await wait(400);
  await p.locator('#sideAvatar').click({ force: true });
  await wait(1800);

  const info = await p.evaluate((id) => {
    const arts = Array.from(document.querySelectorAll('#viewProfile .post'));
    const ids = arts.map(a => a.dataset.id);
    const art = arts.find(a => a.dataset.id === String(id) || a.dataset.id === 'srv_' + id);
    const btn = art && art.querySelector('.pveil-btn');
    return {
      pid: id,
      ids: ids,
      found: !!art,
      btnReveal: btn ? (btn.dataset.reveal || '') : '',
      btnHide: btn ? (btn.dataset.hide || '') : '',
      hasApplyVeil: typeof applyVeil,
      revealed: window.state && state.revealed ? Object.keys(state.revealed) : null
    };
  }, pid);
  console.log('DOM', JSON.stringify(info));

  const after = await p.evaluate((id) => {
    const art = Array.from(document.querySelectorAll('#viewProfile .post'))
      .find(a => a.dataset.id === String(id) || a.dataset.id === 'srv_' + id);
    const btn = art && art.querySelector('.pveil-btn');
    if (btn) applyVeil(btn.dataset.reveal || btn.dataset.hide, true);
    return {
      cls: art ? art.querySelector('.pveil').className : null,
      label: btn ? btn.textContent.trim() : null,
      revealed: Object.keys(state.revealed || {}),
      imgW: art && art.querySelector('img') ? art.querySelector('img').naturalWidth : 0
    };
  }, pid);
  console.log('AFTER applyVeil', JSON.stringify(after));

  /* more 菜单结构 */
  await p.locator(`#viewProfile .post[data-id="srv_${pid}"], #viewProfile .post[data-id="${pid}"]`).first().locator('button[data-act="more"]').click().catch(e => console.log('more fail', e.message.slice(0, 60)));
  await wait(900);
  const menu = await p.evaluate(() => {
    const cands = Array.from(document.querySelectorAll('div,ul')).filter(e => {
      const cs = getComputedStyle(e);
      return cs.position === 'fixed' && cs.display !== 'none' && e.textContent.trim().length < 200 && /删除|复制|收藏/.test(e.textContent);
    });
    return cands.slice(0, 3).map(e => ({ cls: e.className, id: e.id, text: e.textContent.trim().slice(0, 60) }));
  });
  console.log('MENU', JSON.stringify(menu));
  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\diag-menu.png' });
  await b.close();
})();
