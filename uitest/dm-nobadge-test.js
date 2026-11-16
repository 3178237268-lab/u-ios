
const { chromium } = require('playwright-core');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const SITE = 18839, PAGE = 'http://127.0.0.1:' + SITE + '/';
const site = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split('?')[0]); const f = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p); fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(b); }); }).listen(SITE);
let pass = 0, fail = 0;
function ok(c, n, x) { if (c) pass++; else { fail++; console.log('FAIL ' + n + ' :: ' + JSON.stringify(x)); } }
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 3 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.goto(PAGE, { waitUntil: 'load', timeout: 40000 });
  await page.evaluate(() => {
    const now = Date.now(); const msgs = [];
    for (let i = 1; i <= 9; i++) msgs.push({ id: 'nt' + i, type: 'like', user: { name: '阿柚' + i, handle: 'bot_0' + i, key: 'bot_0' + i }, postId: 'p1', createdAt: now - i * 60000, read: false });
    for (let i = 1; i <= 5; i++) msgs.push({ id: 'dm' + i, type: 'dm', from: 'bot_0' + i, text: '私信内容 ' + i, createdAt: now - i * 120000, read: false, peer: { name: '阿柚' + i, handle: 'bot_0' + i } });
    localStorage.setItem('u-msgs', JSON.stringify(msgs)); localStorage.setItem('u-theme', 'dark');
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2000);
  if (await page.$('#guestBtn')) { await page.click('#guestBtn').catch(() => {}); await page.waitForTimeout(2800); }
  await page.evaluate(() => { const t = document.querySelector('.tab[data-tab="dm"]'); if (t) t.click(); });
  await page.waitForTimeout(1500);
  const st = await page.evaluate(() => {
    const view = document.getElementById('viewDM');
    const badges = view ? view.querySelectorAll('.dm-badge, #dmDot') : [];
    const tab = document.querySelector('#dmTabBadge');
    const bell = document.querySelector('#ntTabBadge');
    const rows = view ? view.querySelectorAll('.swipe').length : 0;
    const headText = view ? view.querySelector('.notes-head').textContent.trim() : '';
    return { dmBadges: badges.length, dmDot: !!document.getElementById('dmDot'), tabText: tab && tab.textContent, tabOn: tab && tab.classList.contains('on'), bellText: bell && bell.textContent, bellOn: bell && bell.classList.contains('on'), rows, headText: headText.slice(0, 40) };
  });
  ok(st.dmBadges === 0, 'dm page header has no red badge', st);
  ok(st.dmDot === false, 'no #dmDot element in DOM', st.dmDot);
  ok(st.headText.indexOf('私信') === 0 && st.headText.length <= 3, 'header shows only the title', st.headText);
  ok(st.tabOn === true && Number(st.tabText) > 0, 'dm tab badge still works', [st.tabText, st.tabOn]);
  ok(st.bellOn === true && Number(st.bellText) > 0, 'bell badge still works', [st.bellText, st.bellOn]);
  ok(st.rows > 0, 'dm list still renders', st.rows);
  ok(errs.length === 0, 'no pageerror', errs.slice(0, 3));
  await page.screenshot({ path: path.join(ROOT, 'uitest', 'dm-nobadge.png'), clip: { x: 0, y: 120, width: 420, height: 330 } });
  console.log('ST ' + JSON.stringify(st));
  console.log('RESULT ' + pass + '/' + (pass + fail));
  await browser.close(); site.close(); process.exit(0);
})().catch((e) => { console.log('ERR ' + e.stack); process.exit(1); });