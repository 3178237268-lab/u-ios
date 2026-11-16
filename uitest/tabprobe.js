const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const p = await (await b.newContext({ viewport: { width: 430, height: 900 } })).newPage();
  await p.addInitScript(() => localStorage.setItem('u-server', 'http://127.0.0.1:8787'));
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await wait(1500);
  await p.locator('#authUser').fill('bugb75145');
  await p.locator('#authPass').fill('pass1234');
  await p.locator('#authPass').press('Enter');
  await wait(3500);
  const tabs = await p.locator('.tab').evaluateAll(ns => ns.map(n => {
    const r = n.getBoundingClientRect();
    return { tab: n.dataset.tab, txt: (n.textContent || '').trim().slice(0, 8), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), vis: r.width > 0 && r.height > 0 };
  }));
  console.log(JSON.stringify(tabs, null, 0));
  const bar = await p.locator('.tabbar, #tabbar, nav').evaluateAll(ns => ns.map(n => ({ cls: n.className, id: n.id, rect: n.getBoundingClientRect().toJSON() })));
  console.log('bar =', JSON.stringify(bar).slice(0, 400));
  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\tabbar.png' });
  await b.close();
})();
