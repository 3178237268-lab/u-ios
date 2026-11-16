const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const p = await (await b.newContext({ viewport: { width: 430, height: 900 } })).newPage();
  await p.addInitScript(() => localStorage.setItem('u-server', 'http://127.0.0.1:8787'));
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await wait(2000);
  const inputs = await p.locator('input:visible').evaluateAll(ns => ns.map(n => ({ id: n.id, ph: n.placeholder, type: n.type })));
  console.log('可见 input =', JSON.stringify(inputs));
  const btns = await p.locator('button:visible').evaluateAll(ns => ns.slice(0, 14).map(n => ({ id: n.id, t: (n.textContent || '').trim().slice(0, 12) })));
  console.log('可见 button =', JSON.stringify(btns));
  await b.close();
})();
