const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const p = await (await b.newContext({ viewport: { width: 430, height: 900 } })).newPage();
  const log = [];
  p.on('response', async r => {
    const u = r.url();
    if (!/\/api\//.test(u)) return;
    let body = '';
    try { body = (await r.text()).slice(0, 300); } catch (e) { body = '(no body)'; }
    log.push(r.status() + ' ' + u.replace('http://127.0.0.1:8787', '') + ' -> ' + body);
  });
  await p.addInitScript(() => localStorage.setItem('u-server', 'http://127.0.0.1:8787'));
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await wait(1500);
  await p.locator('#authUser').fill('bugb75145');
  await p.locator('#authPass').fill('pass1234');
  await p.locator('#authPass').press('Enter');
  await wait(4000);
  console.log('=== API 调用 ===');
  log.forEach(l => console.log(l));
  const txts = await p.locator('.post:visible .ptext').allInnerTexts();
  console.log('可见帖子 =', JSON.stringify(txts));
  const tabNow = await p.locator('.tab.active, .tab.on').evaluateAll(ns => ns.map(n => (n.textContent || '').trim()));
  console.log('当前 tab =', JSON.stringify(tabNow));
  await b.close();
})();
