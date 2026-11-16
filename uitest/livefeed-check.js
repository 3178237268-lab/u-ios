
const { chromium } = require('playwright-core');
const fs = require('node:fs'); const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load', timeout: 60000 });
  await sleep(800);
  await page.evaluate(() => { const b = document.querySelector('#guestBtn'); if (b) b.click(); });
  await sleep(6000);
  const r = await page.evaluate(() => ({
    n: document.querySelectorAll('#feedList .post').length,
    authors: [...document.querySelectorAll('#feedList .pname')].map((e) => e.textContent.trim()),
    texts: [...document.querySelectorAll('#feedList .ptext')].map((e) => e.textContent.trim().slice(0, 16))
  }));
  await page.screenshot({ path: path.join(ROOT, '.tmp-test', 'live-feed.png') });
  console.log(JSON.stringify({ live: r, errs }));
  await browser.close();
})().catch((e) => console.log(JSON.stringify({ fatal: String(e).slice(0, 200) })));
