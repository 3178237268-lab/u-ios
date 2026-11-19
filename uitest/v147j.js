const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  for (const w of [412, 360]) {
    const p = await b.newPage({ viewport: { width: w, height: 900 } });
    await p.goto('http://127.0.0.1:8787/admin.html', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(400);
    await p.fill('#lgUser', 'admin123'); await p.fill('#lgPass', 'admin123');
    await p.click('.login-card .btn'); await p.waitForTimeout(2000);
    const r = await p.evaluate(() => {
      const kv = document.getElementById('serverKv');
      const rows = [...kv.querySelectorAll('.row')];
      return rows.map(row => {
        const k = row.querySelector('.k'), v = row.querySelector('.v'), l = row.querySelector('.lead');
        const kb = k.getBoundingClientRect(), vb = v.getBoundingClientRect(), rb = row.getBoundingClientRect();
        return { t: k.textContent.slice(0,6), rowW: Math.round(rb.width), kW: Math.round(kb.width), vW: Math.round(vb.width),
                 leadW: l ? Math.round(l.getBoundingClientRect().width) : 0, kids: row.children.length,
                 vH: Math.round(vb.height), kH: Math.round(kb.height) };
      });
    });
    console.log(w, JSON.stringify(r));
    await p.close();
  }
  await b.close();
})();
