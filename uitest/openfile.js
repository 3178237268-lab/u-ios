const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  const logs = [];
  p.on('console', m => logs.push('CONSOLE ' + m.type() + ': ' + m.text().slice(0,300)));
  p.on('pageerror', e => logs.push('PAGEERROR: ' + String(e).slice(0,300)));
  p.on('requestfailed', r => logs.push('REQFAIL: ' + r.url().slice(0,120) + ' :: ' + (r.failure() && r.failure().errorText)));
  p.on('response', r => { if (r.status() >= 400) logs.push('HTTP ' + r.status() + ' ' + r.url().slice(0,120)); });
  await p.goto('file:///D:/deepseek/gouzuoqu/U/index.html', { waitUntil: 'load', timeout: 30000 }).catch(e => logs.push('GOTO ERR: ' + e.message.slice(0,200)));
  await p.waitForTimeout(4000);
  const info = await p.evaluate(() => ({
    title: document.title,
    bodyLen: document.body.innerText.trim().length,
    head: document.body.innerText.trim().slice(0,150),
    vis: [...document.querySelectorAll('#loginPage,#viewTalk,#guestBtn')].map(e => e.id + '=' + (e.offsetParent !== null)),
    srv: (function(){ try { return localStorage.getItem('u-server'); } catch(e){ return 'LS-ERR:' + e.message; } })(),
    scripts: document.scripts.length
  }));
  console.log(JSON.stringify(info, null, 1));
  console.log('--- logs ---'); logs.slice(0,40).forEach(l => console.log(l));
  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\fileopen.png' });
  await b.close();
})();
