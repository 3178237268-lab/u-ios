const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 950 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8787/admin.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(500);
  await p.fill('#lgUser', 'admin123'); await p.fill('#lgPass', 'admin123');
  await p.click('.login-card .btn'); await p.waitForTimeout(2200);
  const tabs = ['net','users','posts','comments','media','aibots','userdata','feedback','versions','logs','history','api'];
  const out = {};
  for (const t of tabs) {
    await p.evaluate(t => { const e = document.querySelector('.tab[data-tab="'+t+'"], [data-tab="'+t+'"]'); if (e) e.click(); }, t);
    await p.waitForTimeout(1100);
    out[t] = await p.evaluate(() => {
      const rows = [...document.querySelectorAll('.kv .row')].filter(r => r.offsetParent !== null && r.querySelector('.k'));
      const bad = rows.filter(r => { const k=r.querySelector('.k'), v=r.querySelector('.v'); return !v || (v.getBoundingClientRect().left - k.getBoundingClientRect().right) < 6; }).map(r => (r.querySelector('.k').textContent||'').slice(0,10));
      return { rows: rows.length, noLead: rows.filter(r => !r.querySelector('.lead')).length, flat: bad.length, samples: rows.slice(0,3).map(r => r.querySelector('.k').textContent) };
    });
  }
  console.log(JSON.stringify({ out, errs }, null, 1));
  await b.close();
})();
