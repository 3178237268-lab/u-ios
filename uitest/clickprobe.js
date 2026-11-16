const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
const BASE = 'http://127.0.0.1:8787';

(async () => {
  const u = 'cl' + Date.now().toString().slice(-6);
  const tok = (await (await fetch(BASE + '/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: 'pass1234', nickname: u }) })).json()).token;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAFklEQVR42u3BAQ0AAADCoPdPbQ43oAAAAAAAAAB4G4YAAAFRy0HSAAAAAElFTkSuQmCC', 'base64');
  const up = await (await fetch(BASE + '/api/media', { method: 'POST', headers: { 'Content-Type': 'image/png', Authorization: 'Bearer ' + tok, 'X-Filename': 'q.png' }, body: png })).json();
  const post = await (await fetch(BASE + '/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ text: '点击探针 ' + u, sensitive: true, media: [up.id] }) })).json();

  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true })).newPage();
  const logs = [];
  p.on('console', m => logs.push(m.text().slice(0, 200)));
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await wait(2200);
  await p.locator('#authUser').fill(u);
  await p.locator('#authPass').fill('pass1234');
  await p.locator('#authSubmit').click();
  await wait(2600);
  await p.evaluate(() => { const d = document.querySelector('#sideDrawer'); if (d) d.classList.add('open'); const b2 = document.querySelector('#sideBackdrop'); if (b2) b2.classList.add('open'); });
  await wait(400);
  await p.locator('#sideAvatar').click({ force: true });
  await wait(2000);

  await p.evaluate(() => {
    document.addEventListener('click', (e) => {
      const t = e.target;
      console.log('CLK ' + (t.tagName || '?') + '.' + (t.className || '') + ' reveal=' + (t.dataset ? t.dataset.reveal : '') + ' hide=' + (t.dataset ? t.dataset.hide : ''));
    }, true);
  });

  const box = await p.locator('#viewProfile .pveil-btn').first().boundingBox();
  console.log('btn box', JSON.stringify(box));
  await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await wait(800);
  const st = await p.evaluate(() => {
    const v = document.querySelector('#viewProfile .pveil');
    return { cls: v.className, btn: v.querySelector('.pveil-btn').textContent, revealAttr: v.querySelector('.pveil-btn').dataset.reveal, hideAttr: v.querySelector('.pveil-btn').dataset.hide };
  });
  console.log('after click', JSON.stringify(st));
  console.log('logs:'); logs.filter(l => l.startsWith('CLK')).forEach(l => console.log('  ' + l));
  await b.close();
})();
