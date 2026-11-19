const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 950 } });
  await p.goto('http://127.0.0.1:8787/admin.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(500); await p.fill('#lgUser', 'admin123'); await p.fill('#lgPass', 'admin123');
  await p.click('.login-card .btn, .login-card button'); await p.waitForTimeout(1800);
  await p.evaluate(() => {
    const st = document.createElement('style'); st.id = 'plan147';
    st.textContent = `
      .kv{grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px 26px}
      .kv .row{display:flex;align-items:baseline;gap:0;padding:8px 0;border-bottom:1px dashed rgba(255,255,255,.06)}
      .kv .row .k{flex:0 1 auto;min-width:0;white-space:nowrap;color:var(--dim);overflow:hidden;text-overflow:clip}
      .kv .row .k::after{display:none!important}
      .kv .row .k::before{content:'';display:inline-block;height:1px;width:0;margin:0 10px;vertical-align:middle;border-bottom:1px dotted rgba(255,255,255,.22)}
      .kv .row .v{flex:0 0 auto;max-width:62%;text-align:right;overflow-wrap:anywhere;word-break:break-word;line-height:1.45;font-weight:700}
      #serverKv{grid-template-columns:repeat(3,minmax(0,1fr))}
      @media (max-width:1000px){#serverKv{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media (max-width:520px){#serverKv{grid-template-columns:1fr}}
    `;
    document.head.appendChild(st);
  });
  const shot = async (name, clipSel) => {
    const box = await p.evaluate((sel) => {
      const el = document.querySelector(sel); const r = el.getBoundingClientRect();
      return { x: Math.max(0, r.left - 8), y: Math.max(0, r.top - 8), w: r.width + 16, h: r.height + 16 };
    }, clipSel);
    await p.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/' + name + '.png', clip: { x: box.x, y: box.y, width: box.w, height: Math.min(1100, box.h) } });
    return box;
  };
  await shot('plan-overview', '#serverKv');
  // 网络/穿透页
  await p.evaluate(() => { const e = document.querySelector('[data-tab="net"]'); if (e) e.click(); });
  await p.waitForTimeout(1200);
  await p.evaluate(() => { const e = document.querySelector('#tunnelKv'); if (e) e.scrollIntoView(); });
  await p.waitForTimeout(300);
  await shot('plan-net', '#view-net');
  // 数据目录
  await p.evaluate(() => { const e = document.querySelector('[data-tab="settings"]'); if (e) e.click(); });
  await p.waitForTimeout(1200);
  await shot('plan-dir', '#dirKv');
  const metrics = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('.kv .row')].filter(r => r.offsetParent);
    const bad = rows.map(r => {
      const k = r.querySelector('.k'), v = r.querySelector('.v');
      if (!k || !v) return null;
      return { t: k.textContent.slice(0, 8), kH: Math.round(k.getBoundingClientRect().height), gap: Math.round(v.getBoundingClientRect().left - k.getBoundingClientRect().right) };
    }).filter(Boolean);
    return { rows: bad.length, tall: bad.filter(x => x.kH > 24).length, zeroGap: bad.filter(x => x.gap < 6).length, sample: bad.slice(0, 5) };
  });
  console.log(JSON.stringify(metrics, null, 1));
  await b.close();
})();
