const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 950 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8787/admin.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(500);
  await p.fill('#lgUser', 'admin123'); await p.fill('#lgPass', 'admin123');
  await p.click('.login-card .btn'); await p.waitForTimeout(2200);
  await p.click('.tabs .tab[data-tab="net"]'); await p.waitForTimeout(1200);
  await p.evaluate(() => { const el = [...document.querySelectorAll('.panel, .card, h3')].find(e => (e.textContent||'').includes('内网穿透')); if (el) el.scrollIntoView(); });
  await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    const ids = ['netKv','portListKv','tunnelKv','visitorKv','liveKv','dirKv','backupKv'];
    const res = {};
    for (const id of ids) {
      const c = document.getElementById(id);
      if (!c) { res[id] = 'missing'; continue; }
      const rows = [...c.querySelectorAll('.row')];
      res[id] = { rows: rows.length, noLead: rows.filter(x => !x.querySelector('.lead')).length,
        flat: rows.filter(x => { const k=x.querySelector('.k'), v=x.querySelector('.v'); return k&&v&&(v.getBoundingClientRect().left-k.getBoundingClientRect().right)<6; }).length,
        visible: c.offsetParent !== null };
    }
    return res;
  });
  await p.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/v147g-net.png', fullPage: true });
  console.log(JSON.stringify({ r, errs }, null, 1));
  await b.close();
})();
