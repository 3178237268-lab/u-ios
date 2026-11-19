const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage();
  await p.goto('http://127.0.0.1:8787/admin.html');
  console.log(await p.evaluate(() => [...document.querySelectorAll('input')].map(i => i.id + '|' + i.type + '|' + (i.placeholder||''))));
  await b.close();
})();
