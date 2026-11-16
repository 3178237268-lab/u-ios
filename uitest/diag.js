const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const p = await (await b.newContext()).newPage();
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await wait(2000);
  await p.locator('#guestBtn').click(); await wait(1500);
  await p.locator('#composeBtn').click(); await wait(700);
  await p.locator('#composeText').fill('诊断帖 ' + Date.now());
  await p.locator('#composePublish').click(); await wait(2500);
  const like = p.locator('.post button[data-act="like"]').first();
  console.log('like count', await like.count());
  try { await like.click({ timeout: 4000 }); console.log('like ok'); }
  catch (e) { console.log('LIKE ERR >>>'); console.log(String(e.message).split('\n').slice(0, 14).join('\n')); }
  const dbg = await p.evaluate(() => {
    const els = [...document.querySelectorAll('body > *')].map(e => ({ id: e.id || e.className, op: getComputedStyle(e).pointerEvents, disp: getComputedStyle(e).display, z: getComputedStyle(e).zIndex, pe: getComputedStyle(e).position }));
    const btn = document.querySelector('.post button[data-act="like"]');
    let boxes = [];
    if (btn) { const r = btn.getBoundingClientRect(); const at = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2); boxes = [r.x|0, r.y|0, r.width|0, r.height|0, at ? (at.tagName + '#' + (at.id||at.className)) : 'null']; }
    return { overlays: els.filter(e => e.pe === 'fixed' || e.pe === 'absolute').slice(0, 12), btn: boxes, tab: document.querySelector('.tab.on, .tab.active') ? 'has-active' : 'none' };
  });
  console.log(JSON.stringify(dbg, null, 1).slice(0, 1600));
  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\diag.png' });
  await b.close();
})();
