
const { chromium } = require('playwright-core');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..'); const SITE = 18785;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const site = http.createServer((q, s) => fs.readFile(path.join(ROOT, 'index.html'), (e, b) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); s.end(b); })).listen(SITE);
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
  await page.goto('http://127.0.0.1:' + SITE + '/', { waitUntil: 'load', timeout: 40000 });
  await sleep(1200);
  const r = await page.evaluate(() => {
    const g = (sel) => { const el = document.querySelector(sel); if (!el) return null; const c = getComputedStyle(el); const b = el.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), fs: c.fontSize, pad: c.padding, top: Math.round(b.top) }; };
    const logo = document.querySelector('.auth-logo'); const svg = logo && logo.querySelector('svg');
    const sc = document.querySelector('.auth');
    return { logo: g('.auth-logo'), logoSvg: svg ? { w: Math.round(svg.getBoundingClientRect().width), h: Math.round(svg.getBoundingClientRect().height) } : null, tabs: g('.auth-tabs button'), field: g('#authUser'), submit: g('#authSubmit'), guest: g('#guestBtn'), link: g('#localModeBtn'), gear: g('#authGear'), gearSvg: (() => { const s = document.querySelector('#authGear svg'); const b = s && s.getBoundingClientRect(); return b ? Math.round(b.width) : null; })(), overflowX: sc ? sc.scrollWidth - sc.clientWidth : null };
  });
  await page.screenshot({ path: path.join(ROOT, '.tmp-test', 'login-big.png') });
  console.log(JSON.stringify({ r, errs }));
  await browser.close();
})().catch((e) => console.log(JSON.stringify({ fatal: String(e).slice(0, 160) }))).finally(() => site.close());
