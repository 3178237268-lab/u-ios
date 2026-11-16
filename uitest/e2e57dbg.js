
const { chromium } = require('playwright-core');
const SITE = 'http://127.0.0.1:8765/index.html', API = 'http://127.0.0.1:8787';
const MARK = 'E2E57';
(async () => {
  const out = { errs: [], bad: [], tap: [] };
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
  p.on('pageerror', e => out.errs.push(String(e).slice(0,180)));
  p.on('console', m => { if (m.type()==='error') out.bad.push(m.text().slice(0,150)); });
  p.on('response', r => { if (r.status()>=400) out.bad.push(r.status()+' '+r.url().slice(0,80)); });
  await p.goto(SITE, { waitUntil: 'load' });
  await p.evaluate(s => localStorage.setItem('u-server', s), API);
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(900);
  await p.fill('#authUser','viewer57'); await p.fill('#authPass','viewer123'); await p.click('#authSubmit');
  await p.waitForTimeout(3500);
  await p.evaluate((m) => { const el = Array.from(document.querySelectorAll('.post')).find(a=>(a.textContent||'').indexOf(m)>=0); if (el) el.scrollIntoView({block:'center'}); }, MARK);
  await p.waitForTimeout(800);
  const pid = await p.evaluate((m) => (Array.from(document.querySelectorAll('.post')).find(a=>(a.textContent||'').indexOf(m)>=0)||{}).dataset?.id, MARK);
  out.pid = pid;
  /* 显示 18+ */
  await p.click('.post[data-id="'+pid+'"] .pveil-btn').catch(e=>out.errs.push('veil '+e.message.slice(0,80)));
  await p.waitForTimeout(600);
  /* 命中测试：按钮中心是什么元素 */
  out.hit = await p.evaluate((id) => {
    const btn = document.querySelector('.post[data-id="'+id+'"] .vgexp');
    const r = btn.getBoundingClientRect();
    const el = document.elementFromPoint(r.x+r.width/2, r.y+r.height/2);
    return { rect: [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)], hit: el ? (el.tagName+'.'+el.className).slice(0,60) : null, btnVis: getComputedStyle(btn).visibility, btnZ: getComputedStyle(btn).zIndex };
  }, pid);
  /* 点视频块中央 */
  const box = await p.evaluate((id) => { const r = document.querySelector('.post[data-id="'+id+'"] .vplayer.vgrid .vstage').getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; }, pid);
  await p.mouse.click(box.x, box.y);
  for (let i = 0; i < 8; i++) {
    await p.waitForTimeout(700);
    out.tap.push(await p.evaluate((id) => { const v = document.querySelector('.post[data-id="'+id+'"] .vplayer.vgrid video'); return { t:+v.currentTime.toFixed(2), rs:v.readyState, ns:v.networkState, w:v.videoWidth, paused:v.paused, src:(v.getAttribute('src')||'').slice(-30), err:v.error&&v.error.code }; }, pid));
  }
  await p.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/e2e57-debug.png' });
  console.log(JSON.stringify(out, null, 1).slice(0,4000));
  await b.close();
})();
