const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const p = await (await b.newContext()).newPage();
  const logs = [], bad = [];
  p.on('pageerror', e => logs.push('PAGEERR ' + String(e).slice(0, 160)));
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push('CONSOLE ' + m.type() + ': ' + m.text().slice(0, 160)); });
  p.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url().slice(0, 100)); });
  await p.goto('http://127.0.0.1:8765/.tmp-test/preview-sandbox.html', { waitUntil: 'load' });
  await p.waitForTimeout(2500);
  const fr = p.frames().find(f => f.url().includes('index.html'));
  const st = await fr.evaluate(() => {
    const s = document.getElementById('splash');
    return { splash: !!s, hidden: s ? s.classList.contains('hide') : null, booting: document.body.classList.contains('booting'), guest: !!document.getElementById('guestBtn'), posts: document.querySelectorAll('.post').length };
  });
  console.log('state', JSON.stringify(st));
  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\sxb2.png' });
  console.log('404s', JSON.stringify(bad.slice(0, 6)));
  console.log('logs'); logs.slice(0, 12).forEach(l => console.log(' ', l));
  await b.close();
})();
