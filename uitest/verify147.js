const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 950 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8787/admin.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(600);
  await p.fill('#lgUser', 'admin123'); await p.fill('#lgPass', 'admin123');
  await p.click('.login-card .btn, .login-card button'); await p.waitForTimeout(1800);
  const tabs = ['overview', 'live', 'settings', 'net', 'users', 'posts', 'feedback'];
  const res = {};
  for (const t of tabs) {
    await p.evaluate(t => { const e = document.querySelector('[data-tab="' + t + '"]'); if (e) e.click(); }, t);
    await p.waitForTimeout(1300);
    res[t] = await p.evaluate(() => {
      const rows = [...document.querySelectorAll('.kv .row')].filter(r => r.offsetParent !== null);
      const info = rows.map(r => {
        const k = r.querySelector('.k'), v = r.querySelector('.v'), l = r.querySelector('.lead');
        if (!k || !v) return null;
        const kb = k.getBoundingClientRect(), vb = v.getBoundingClientRect(), lb = l ? l.getBoundingClientRect() : null;
        return { t: (k.textContent || '').slice(0, 10), kH: Math.round(kb.height), kL: Math.round(kb.left), vR: Math.round(vb.right),
                 leadW: lb ? Math.round(lb.width) : 0, gapKV: Math.round(vb.left - kb.right), rowW: Math.round(r.getBoundingClientRect().width) };
      }).filter(Boolean);
      return {
        rows: info.length,
        noLead: info.filter(i => i.leadW === 0).map(i => i.t),
        flat: info.filter(i => i.gapKV < 6).map(i => i.t),
        tallKey: info.filter(i => i.kH > 24).map(i => i.t),
        rightOut: info.filter(i => i.vR > Math.round(r0() || 99999)).length,
        sample: info.slice(0, 6),
        cols: (document.querySelector('#serverKv') ? getComputedStyle(document.querySelector('#serverKv')).gridTemplateColumns : ''),
        overflow: document.documentElement.scrollWidth - innerWidth
      };
      function r0() { const kv = document.querySelector('#serverKv'); return kv ? kv.getBoundingClientRect().right + 2 : 0; }
    }).catch(e => ({ err: String(e) }));
    await p.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/v147-' + t + '.png' });
  }
  console.log(JSON.stringify({ res, errs }, null, 1));
  await b.close();
})();
