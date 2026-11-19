const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport: { width: 412, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8787/admin.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(500);
  await p.fill('#lgUser', 'admin123'); await p.fill('#lgPass', 'admin123');
  await p.click('.login-card .btn'); await p.waitForTimeout(2000);
  await p.evaluate(() => window.scrollTo(0, 900)); await p.waitForTimeout(400);
  await p.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/v147d-mobile-kv.png' });
  const r = await p.evaluate(() => [...document.querySelectorAll('#serverKv .row')].slice(0,4).map(row => {
    const k = row.querySelector('.k'), v = row.querySelector('.v'), l = row.querySelector('.lead');
    const kb = k.getBoundingClientRect(), vb = v.getBoundingClientRect(), lb = l.getBoundingClientRect();
    return { t: k.textContent, leadW: Math.round(lb.width), gap: Math.round(vb.left - kb.right), rowW: Math.round(row.getBoundingClientRect().width) };
  }));
  // 各行菜单
  const tabs = ['users','posts','comments','media','aibots','userdata','feedback','versions','logs','history','api','net'];
  const tabres = {};
  for (const t of tabs) {
    await p.evaluate(t => { const e = document.querySelector('[data-tab="'+t+'"]'); if (e) e.click(); }, t);
    await p.waitForTimeout(900);
    tabres[t] = await p.evaluate(() => {
      const rows = [...document.querySelectorAll('.kv .row')].filter(r => r.offsetParent !== null && r.querySelector('.k'));
      return { rows: rows.length, noLead: rows.filter(r => !r.querySelector('.lead')).map(r => r.querySelector('.k').textContent.slice(0,8)),
               flat: rows.filter(r => { const k=r.querySelector('.k'), v=r.querySelector('.v'); return v && (v.getBoundingClientRect().left - k.getBoundingClientRect().right) < 6; }).map(r => r.querySelector('.k').textContent.slice(0,8)),
               overflow: document.documentElement.scrollWidth - innerWidth };
    });
  }
  console.log(JSON.stringify({ r, tabres, errs }, null, 1));
  await b.close();
})();
