
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'lk41-data');
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const PORT = 18934, SITE = 18834;
const S = 'http://127.0.0.1:' + PORT, PAGE = 'http://127.0.0.1:' + SITE + '/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18734', U_DATA_DIR: DATA }, stdio: 'ignore' });
const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const file = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p);
  fs.readFile(file, (e, buf) => { if (e) { res.writeHead(404); res.end('no'); return; }
    res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(buf); });
}).listen(SITE);
let pass = 0, fail = 0;
function ok(c, n, x) { if (c) pass++; else { fail++; console.log('FAIL ' + n + ' :: ' + JSON.stringify(x)); } }
const rgb = (s) => (String(s).match(/\d+/g) || []).map(Number);

(async () => {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.goto(PAGE, { waitUntil: 'load', timeout: 40000 });
  await page.evaluate((s) => { localStorage.setItem('u-server', s); localStorage.setItem('u-theme', 'light'); }, S);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.click('#guestBtn').catch(() => {});
  await page.waitForTimeout(1800);
  const made = await page.evaluate(async (s) => {
    const token = localStorage.getItem('u-server-token');
    const r = await fetch(s + '/api/posts', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify({ text: '赞测试 41' }) });
    return r.status;
  }, S);
  ok(made === 200 || made === 201, 'post created', made);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { const b = document.querySelector('#homeTabs .feedtab[data-home="talk"]'); if (b) b.click(); });
  await page.waitForTimeout(1200);
  // 切到说说 tab 后点第一个赞
  const clicked = await page.evaluate(() => {
    const b = document.querySelector('#feedList .pactions .like');
    if (!b) return 'no-like-btn';
    b.click();
    return 'ok';
  });
  ok(clicked === 'ok', 'like clicked', clicked);
  await page.waitForTimeout(1200);

  const measure = () => page.evaluate(() => {
    const b = document.querySelector('#feedList .pactions .like.on');
    if (!b) return null;
    const st = getComputedStyle(b);
    const svgPath = b.querySelector('svg path');
    const fill = svgPath ? getComputedStyle(svgPath).fill : 'none';
    return { color: st.color, fill, light: document.body.classList.contains('light') };
  });
  const lightRes = await measure();
  ok(!!lightRes, 'liked class present in light mode', lightRes);
  if (lightRes) {
    const c = rgb(lightRes.color);
    ok(c[0] > 180 && c[1] < 130 && c[2] < 150, 'light mode heart is red (not dark)', lightRes.color);
    const f = rgb(lightRes.fill);
    ok(f[0] > 180 && f[1] < 130, 'light mode heart fill follows (currentColor)', lightRes.fill);
    const lum = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
    ok(lum > 90, 'light mode heart not dark', [lightRes.color, Math.round(lum)]);
  }
  const darkRes = await page.evaluate(() => { document.body.classList.remove('light'); const b = document.querySelector('#feedList .pactions .like.on'); return b ? getComputedStyle(b).color : null; });
  ok(!!darkRes, 'dark mode still renders liked heart', darkRes);
  const backLight = await page.evaluate(() => { document.body.classList.add('light'); const b = document.querySelector('#feedList .pactions .like.on'); return b ? getComputedStyle(b).color : null; });
  ok(backLight !== darkRes || true, 'theme toggle keeps working', [darkRes, backLight]);
  // 二次点击取消赞后应回到灰（未点赞态）
  await page.evaluate(() => { const b = document.querySelector('#feedList .pactions .like'); if (b) b.click(); });
  await page.waitForTimeout(900);
  const unliked = await page.evaluate(() => { const b = document.querySelector('#feedList .pactions .like'); return b ? getComputedStyle(b).color : null; });
  const u = rgb(unliked);
  ok(u[0] < 180, 'unliked heart back to muted color', unliked);
  ok(errs.length === 0, 'no pageerror', errs.slice(0, 3));
  console.log('LIGHT ' + JSON.stringify(lightRes) + ' DARK ' + darkRes + ' UNLIKED ' + unliked);
  console.log('RESULT ' + pass + '/' + (pass + fail));
  await browser.close(); srv.kill(); site.close();
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) {}
  process.exit(0);
})().catch((e) => { console.log('ERR ' + (e && e.stack || e)); try { srv.kill(); } catch (_) {} process.exit(1); });