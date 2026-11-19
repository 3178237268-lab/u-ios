const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 950 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8787/admin.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(500);
  await p.fill('#lgUser', 'admin123'); await p.fill('#lgPass', 'admin123');
  await p.click('.login-card .btn'); await p.waitForTimeout(2000);
  const out = await p.evaluate(() => {
    const a = [...document.querySelectorAll('.addr-item')].map(r => {
      const k = r.querySelector('.addr-k'), v = r.querySelector('.addr-v'), l = r.querySelector('.lead');
      const kb = k.getBoundingClientRect(), vb = v.getBoundingClientRect();
      return { t: k.textContent.slice(0, 14), leadW: l ? Math.round(l.getBoundingClientRect().width) : 0,
               gapKV: Math.round(vb.left - kb.right), rowW: Math.round(r.getBoundingClientRect().width) };
    });
    const all = document.querySelectorAll('.kv .row').length;
    const noLead = [...document.querySelectorAll('.kv .row')].filter(r => !r.querySelector('.lead') && r.querySelector('.k')).length;
    return { addr: a, kvRows: all, kvNoLead: noLead, overflow: document.documentElement.scrollWidth - innerWidth };
  });
  await p.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/v147c-overview.png' });
  await p.evaluate(() => document.querySelector('[data-tab="settings"]').click()); await p.waitForTimeout(1200);
  await p.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/v147c-settings.png' });
  await p.evaluate(() => document.querySelector('[data-tab="live"]').click()); await p.waitForTimeout(1000);
  await p.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/v147c-live.png' });
  const m = await b.newPage({ viewport: { width: 412, height: 900 } });
  const merrs = []; m.on('pageerror', e => merrs.push(e.message));
  await m.goto('http://127.0.0.1:8787/admin.html', { waitUntil: 'domcontentloaded' });
  await m.waitForTimeout(500);
  await m.fill('#lgUser', 'admin123'); await m.fill('#lgPass', 'admin123');
  await m.click('.login-card .btn'); await m.waitForTimeout(2000);
  const mo = await m.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth,
    cols: getComputedStyle(document.querySelector('#serverKv')).gridTemplateColumns }));
  await m.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/v147c-mobile.png', fullPage: false });
  console.log(JSON.stringify({ out, mo, errs, merrs }, null, 1));
  await b.close();
})();
