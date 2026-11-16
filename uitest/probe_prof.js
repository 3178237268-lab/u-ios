const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
const BASE = 'http://127.0.0.1:8787';

(async () => {
  const u = 'prb' + Date.now().toString().slice(-6);
  const r0 = await fetch(BASE + '/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: 'pass1234', nickname: u }) });
  const tok = (await r0.json()).token;
  const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000002000000020806000000f4784b3b0000001649444154789c636060606064606060f80f0006000101a5f8f3d20000000049454e44ae426082', 'hex');
  const up = await (await fetch(BASE + '/api/media', { method: 'POST', headers: { 'Content-Type': 'image/png', Authorization: 'Bearer ' + tok, 'X-Filename': 'p.png' }, body: png })).json();
  const post = await (await fetch(BASE + '/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ text: '探针18+ ' + u, sensitive: true, media: [up.id] }) })).json();
  const apiPost = await (await fetch(BASE + '/api/posts/' + post.post.id, { headers: { Authorization: 'Bearer ' + tok } })).json();
  console.log('API media:', JSON.stringify(apiPost.post.media));

  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true })).newPage();
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await wait(2200);
  await p.locator('#authUser').fill(u);
  await p.locator('#authPass').fill('pass1234');
  await p.locator('#authSubmit').click();
  await wait(2600);
  await p.evaluate(() => { const d = document.querySelector('#sideDrawer'); if (d) d.classList.add('open'); const b2 = document.querySelector('#sideBackdrop'); if (b2) b2.classList.add('open'); });
  await wait(500);
  await p.locator('#sideAvatar').click({ force: true });
  await wait(2000);

  const dump = await p.evaluate(() => {
    const art = document.querySelector('#viewProfile .post');
    const pm = art && art.querySelector('.pmedia');
    return {
      article: art ? art.outerHTML.slice(0, 1200) : null,
      mediaClass: pm ? pm.className : null,
      mediaBox: pm ? [Math.round(pm.getBoundingClientRect().width), Math.round(pm.getBoundingClientRect().height)] : null,
      img: pm && pm.querySelector('img') ? { src: pm.querySelector('img').getAttribute('src'), nw: pm.querySelector('img').naturalWidth } : null,
      pend: pm && pm.querySelector('.pend') ? pm.querySelector('.pend').textContent : null
    };
  });
  console.log(JSON.stringify(dump, null, 1));
  await b.close();
})();
