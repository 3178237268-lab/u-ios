const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
const BASE = 'http://127.0.0.1:8787';

(async () => {
  const u = 'vc' + Date.now().toString().slice(-6);
  const tok = (await (await fetch(BASE + '/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: 'pass1234', nickname: u }) })).json()).token;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAFklEQVR42u3BAQ0AAADCoPdPbQ43oAAAAAAAAAB4G4YAAAFRy0HSAAAAAElFTkSuQmCC', 'base64');
  const up = await (await fetch(BASE + '/api/media', { method: 'POST', headers: { 'Content-Type': 'image/png', Authorization: 'Bearer ' + tok, 'X-Filename': 'q.png' }, body: png })).json();
  const post = await (await fetch(BASE + '/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ text: '遮罩探针 ' + u, sensitive: true, media: [up.id] }) })).json();
  console.log('post', post.post.id, 'media', up.id);

  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true })).newPage();
  const logs = [];
  p.on('console', m => logs.push(m.type() + ': ' + m.text().slice(0, 120)));
  p.on('pageerror', e => logs.push('PAGEERR ' + String(e).slice(0, 200)));

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

  const before = await p.evaluate(() => {
    const img = document.querySelector('#viewProfile .pmedia img');
    const v = document.querySelector('#viewProfile .pveil');
    return {
      imgSrc: img && img.getAttribute('src'), nw: img && img.naturalWidth,
      veilCls: v && v.className, box: v ? [Math.round(v.getBoundingClientRect().width), Math.round(v.getBoundingClientRect().height)] : null,
      btn: v && v.querySelector('.pveil-btn').textContent
    };
  });
  console.log('before', JSON.stringify(before));

  // 真实鼠标点击「显示」
  const btn = p.locator('#viewProfile .pveil-btn').first();
  await btn.click({ force: true });
  await wait(700);
  const after = await p.evaluate(() => {
    const imgs = document.querySelectorAll('#viewProfile .pmedia');
    const v = document.querySelector('#viewProfile .pveil');
    return {
      mediaCls: Array.from(imgs).map(x => x.className),
      veilCls: v && v.className, btn: v && v.querySelector('.pveil-btn') && v.querySelector('.pveil-btn').textContent,
      sheetOpen: !!document.querySelector('#postSheet.open')
    };
  });
  console.log('after', JSON.stringify(after));

  // 再点遮罩空白处（应显示而不是弹详情）
  const vbox = await p.locator('#viewProfile .pveil').first().boundingBox();
  if (vbox) { await p.mouse.click(vbox.x + 8, vbox.y + 6); await wait(600); }
  const after2 = await p.evaluate(() => ({ sheet: !!document.querySelector('#postSheet.open'), btn: (document.querySelector('#viewProfile .pveil-btn') || {}).textContent }));
  console.log('after2', JSON.stringify(after2));

  // 点正文打开详情
  await p.locator('#viewProfile .post .ptext').first().click({ force: true });
  await wait(1200);
  const det = await p.evaluate(() => ({ open: !!document.querySelector('#postSheet.open'), body: (document.querySelector('#postBody') || {}).innerText ? document.querySelector('#postBody').innerText.slice(0, 40) : '' }));
  console.log('detail', JSON.stringify(det));

  // 详情里的遮罩
  const detVeil = await p.evaluate(() => {
    const v = document.querySelector('#postSheet .pveil');
    return v ? { cls: v.className, btn: v.querySelector('.pveil-btn').textContent } : null;
  });
  console.log('detail veil', JSON.stringify(detVeil));

  console.log('logs', logs.length); logs.slice(0, 8).forEach(l => console.log('  ' + l));
  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\veilprof.png' });
  await b.close();
})();
