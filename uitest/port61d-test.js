const { chromium } = require('playwright-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://192.168.1.217:17880/';
const log = []; const ok = (n, c, x) => log.push((c ? 'PASS ' : 'FAIL ') + n + (x ? ' | ' + x : ''));
const sleep = (n) => new Promise(r => setTimeout(r, n));
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(URL, { waitUntil: 'domcontentloaded' }); await sleep(1000);
  await page.fill('#authUser', 'admin123'); await page.fill('#authPass', 'admin123');
  await page.click('#authSubmit'); await sleep(3500);
  await page.evaluate(() => { document.getElementById('sideDrawer').classList.add('open'); });
  await sleep(400);
  await page.click('[data-side="settings"]'); await sleep(900);
  const rowVisible = await page.locator('#adminApiRow').isVisible().catch(() => false);
  ok('设置页有接口入口', rowVisible);
  if (rowVisible) { await page.click('#adminApiRow'); await sleep(1500); }
  const shown = await page.evaluate(() => { const a = document.querySelector('#apiUrl'); return a ? a.textContent : 'none'; });
  ok('接口页地址=真实局域网地址', shown === 'http://192.168.1.217:17880/index.html', shown);
  ok('无 pageerror', errs.length === 0, errs.join(' | ').slice(0, 150));
  await page.screenshot({ path: '.tmp-test/port61c.png' });
  console.log(log.join('\n')); console.log('SUMMARY ' + log.filter(x => x.startsWith('PASS')).length + '/' + log.length);
  await browser.close(); process.exit(0);
})().catch(e => { console.log('FATAL ' + e.message); console.log(log.join('\n')); process.exit(1); });
