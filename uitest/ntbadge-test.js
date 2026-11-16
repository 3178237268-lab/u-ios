
const { chromium } = require('playwright-core');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const SITE = 18838, PAGE = 'http://127.0.0.1:' + SITE + '/';
const site = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split('?')[0]); const f = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p); fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(b); }); }).listen(SITE);
let pass = 0, fail = 0;
function ok(c, n, x) { if (c) pass++; else { fail++; console.log('FAIL ' + n + ' :: ' + JSON.stringify(x)); } }
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.goto(PAGE, { waitUntil: 'load', timeout: 40000 });
  await page.evaluate(() => {
    const now = Date.now();
    const msgs = [1,2,3].map((i) => ({ id: 'm' + i, type: i === 3 ? 'follow' : 'like', user: { name: '阿柚' + i, handle: 'bot_0' + i, key: 'bot_0' + i }, postId: 'p1', createdAt: now - i * 60000, read: false }));
    localStorage.setItem('u-msgs', JSON.stringify(msgs));
    localStorage.setItem('u-theme', 'dark');
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1800);
  if (await page.$('#guestBtn')) { await page.click('#guestBtn').catch(() => {}); await page.waitForTimeout(2500); }
  await page.waitForTimeout(1500);
  const read = () => page.evaluate(() => {
    const b = document.querySelector('#ntTabBadge');
    if (!b) return null;
    const cs = getComputedStyle(b);
    const r = b.getBoundingClientRect();
    const tab = b.closest('.tab').getBoundingClientRect();
    return { text: b.textContent, on: b.classList.contains('on'), display: cs.display, bg: cs.backgroundColor, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }, tab: { x: Math.round(tab.x), y: Math.round(tab.y), w: Math.round(tab.width), h: Math.round(tab.height) } };
  });
  const s1 = await read();
  ok(!!s1, 'badge element exists on notify tab', s1);
  ok(s1 && s1.on === true && s1.display !== 'none', 'badge visible when unread exists', s1);
  ok(s1 && s1.text === '3', 'badge shows unread count 3', s1 && s1.text);
  ok(!!s1 && /255,\s*92,\s*108/.test(s1.bg || ''), 'badge is red', s1 && s1.bg);
  ok(!!s1 && s1.rect.w > 0 && s1.rect.y < s1.tab.y + s1.tab.h && s1.rect.x > s1.tab.x + s1.tab.w / 2 - 6, 'badge sits at upper-right of the bell', s1);
  // 打开通知 -> 消息，点一条消息后角标应减一
  await page.evaluate(() => { const t = document.querySelector('.tab[data-tab="notify"]'); if (t) t.click(); });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { const b = document.querySelector('#notifyTabs .ntab[data-ntab="msg"]'); if (b) b.click(); });
  await page.waitForTimeout(1200);
  const rows = await page.evaluate(() => document.querySelectorAll('#notifyList .msg-row, #notifyList [data-mid]').length);
  await page.evaluate(() => { const r = document.querySelector('#notifyList [data-mid]') || document.querySelector('#notifyList .msg-row'); if (r) r.click(); });
  await page.waitForTimeout(1500);
  const s2 = await read();
  ok(!!s2 && Number(s2.text) < 3, 'badge count decreases after reading one', [rows, s2 && s2.text]);
  // 全部读完后角标隐藏
  await page.evaluate(() => { const list = JSON.parse(localStorage.getItem('u-msgs') || '[]'); list.forEach((m) => { m.read = true; }); localStorage.setItem('u-msgs', JSON.stringify(list)); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2200);
  const s3 = await read();
  ok(!!s3 && s3.on === false && s3.display === 'none', 'badge hidden when nothing unread', s3);
  ok(errs.length === 0, 'no pageerror', errs.slice(0, 3));
  await page.screenshot({ path: path.join(ROOT, 'uitest', 'ntbadge.png'), clip: { x: 0, y: 760, width: 420, height: 140 } }).catch(() => {});
  console.log('S1 ' + JSON.stringify(s1)); console.log('S2 ' + JSON.stringify(s2)); console.log('S3 ' + JSON.stringify(s3));
  console.log('RESULT ' + pass + '/' + (pass + fail));
  await browser.close(); site.close(); process.exit(0);
})().catch((e) => { console.log('ERR ' + e.stack); process.exit(1); });