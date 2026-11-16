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
  await page.evaluate(() => { openApiSheet(); }); await sleep(1200);
  const shown = await page.evaluate(() => { const a = document.querySelector('#apiUrl'); const b = document.querySelector('#apiBody'); return { url: a ? a.textContent : 'none', has: b ? b.innerHTML.length : 0 }; });
  ok('接口页地址=当前局域网地址', shown.url === 'http://192.168.1.217:17880/index.html', JSON.stringify(shown));
  ok('无 pageerror', errs.length === 0, errs.join(' | ').slice(0, 150));
  console.log(log.join('\n')); console.log('SUMMARY ' + log.filter(x => x.startsWith('PASS')).length + '/' + log.length);
  await browser.close(); process.exit(0);
})().catch(e => { console.log('FATAL ' + e.message); process.exit(1); });
