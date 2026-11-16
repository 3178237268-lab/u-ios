const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const p = await (await b.newContext()).newPage();
  const logs = [];
  p.on('console', m => logs.push('PAGE ' + m.type() + ': ' + m.text().slice(0, 200)));
  p.on('pageerror', e => logs.push('PAGEERR ' + String(e).slice(0, 200)));
  p.on('frameattached', f => {});
  await p.goto('http://127.0.0.1:8765/.tmp-test/preview-sandbox.html', { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  const fr = p.frames().find(f => f.url().includes('index.html'));
  if (!fr) { console.log('NO FRAME'); await b.close(); return; }
  fr.on && 0;
  await fr.waitForTimeout ? null : null;
  const st1 = await fr.evaluate(() => ({
    splash: !!document.getElementById('splash'),
    splashHidden: (() => { const s = document.getElementById('splash'); return !s || s.classList.contains('hide'); })(),
    booting: document.body.classList.contains('booting'),
    guest: !!document.getElementById('guestBtn'),
    authVisible: (() => { const a = document.getElementById('authPage'); return a ? a.offsetParent !== null : null; })()
  })).catch(e => ({ err: e.message.slice(0, 200) }));
  console.log('t+1.2s', JSON.stringify(st1));
  await p.waitForTimeout(3000);
  const st2 = await fr.evaluate(() => ({
    splash: !!document.getElementById('splash'),
    guest: !!document.getElementById('guestBtn'),
    feed: document.querySelectorAll('.post').length
  })).catch(e => ({ err: e.message.slice(0, 200) }));
  console.log('t+4.2s', JSON.stringify(st2));
  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\sandbox-1.png' });
  console.log('--- console ---');
  logs.slice(0, 25).forEach(l => console.log(l));
  await b.close();
})();
