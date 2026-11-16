
const { chromium } = require('playwright-core');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..'); const SITE = 18811;
const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const file = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p);
  fs.readFile(file, (e, buf) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(buf); });
}).listen(SITE);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 150)));
  await page.goto('http://127.0.0.1:' + SITE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(900);
  const gb = await page.$('#guestBtn'); if (gb) { await gb.click(); await page.waitForTimeout(1300); }
  const probe = async (label, open, sel) => {
    await page.evaluate(open);
    await sleep(700);
    const r = await page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const cs = getComputedStyle(e); const bb = e.getBoundingClientRect(); return { vis: cs.visibility, op: cs.opacity, top: Math.round(bb.top), h: Math.round(bb.height), firstVisible: (function(){ const kids = e.querySelectorAll(':scope > *'); for (const k of kids) { if (getComputedStyle(k).visibility === 'visible' && k.getBoundingClientRect().height > 4) return k.className || k.tagName; } return 'none'; })() }; }, sel);
    console.log(label + ' ' + JSON.stringify(r));
  };
  await probe('SETTINGS', () => { const d = document.querySelector('#sideDrawer'); d && d.classList.add('open'); document.querySelector('[data-side="settings"]').click(); }, '#settingsSheet');
  await page.evaluate(() => { document.querySelectorAll('.sheet.open').forEach(s => s.classList.remove('open')); });
  await sleep(400);
  await probe('SILK', () => { const d = document.querySelector('#sideDrawer'); d && d.classList.add('open'); document.querySelector('[data-side="silk"]').click(); }, '#silkSheet');
  await page.evaluate(() => { document.querySelectorAll('.sheet.open').forEach(s => s.classList.remove('open')); const bd = document.querySelector('#sideBackdrop'); bd && bd.classList.remove('open'); const d = document.querySelector('#sideDrawer'); d && d.classList.remove('open'); });
  await sleep(400);
  await probe('COMPOSE', () => { document.querySelector('#composeBtn').click(); }, '#compose');
  console.log('ERRS ' + JSON.stringify(errs));
  await b.close(); site.close(); process.exit(0);
})().catch(e => { console.log('ERR ' + e); process.exit(2); });
