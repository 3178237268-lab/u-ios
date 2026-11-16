const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
const BASE = 'http://127.0.0.1:8787';

(async () => {
  const r = await fetch(BASE + '/api/guest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  const g = await r.json();
  console.log('guest', g.user && g.user.username, 'token?', !!g.token);

  const b = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader']
  });
  const ctx = await b.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await wait(2200);
  await p.locator('#guestBtn').click();
  await wait(2500);

  const info = await p.evaluate(() => {
    const arts = Array.from(document.querySelectorAll('.post'));
    const first = arts[0];
    const withMedia = arts.filter(a => a.querySelector('.pmedia')).length;
    return {
      total: arts.length,
      withMedia,
      firstHTML: first ? first.innerHTML.slice(0, 700) : null,
      mediaCount: document.querySelectorAll('.pmedia').length,
      veilCount: document.querySelectorAll('.pveil').length
    };
  });
  console.log(JSON.stringify(info, null, 1).slice(0, 2000));
  await b.close();
})();
