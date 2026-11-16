
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'round-data');
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const PORT = 18930, SITE = 18783;
const S = 'http://127.0.0.1:' + PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18782', U_DATA_DIR: DATA }, stdio: 'ignore' });
const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const f = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(b); });
}).listen(SITE);
(async () => {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }
  const reg = await (await fetch(S + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'lizi', password: 'lizi123', nickname: '栗子汽水' }) })).json();
  const tok = reg.token;
  const mk = (text) => fetch(S + '/api/posts', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: JSON.stringify({ text, media: [] }) });
  await mk('冒昧打扰一下，你那边今天下雨了吗，我这边下了一整天。');
  await mk('路过小学门口，听见放学的铃声。');
  await mk('今天的晚霞好看得不像话。');
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.goto('http://127.0.0.1:' + SITE + '/', { waitUntil: 'load', timeout: 40000 });
  await page.evaluate((s) => { localStorage.setItem('u-server', s); localStorage.removeItem('u-dm-hidden'); }, S);
  await page.reload({ waitUntil: 'load' }); await sleep(700);
  const g = await page.$('#guestBtn'); if (g) { await g.click(); await sleep(2500); }
  await sleep(1200);
  const shot = async (n) => page.screenshot({ path: path.join(ROOT, '.tmp-test', n) });
  const nPosts = await page.evaluate(() => document.querySelectorAll('.post').length);
  await shot('r3-home.png');
  await page.evaluate(() => { document.querySelector('#sideDrawer').classList.add('open'); document.querySelector('#sideBackdrop').classList.add('open'); });
  await sleep(600); await shot('r3-drawer.png');
  await page.evaluate(() => { document.querySelector('#sideDrawer').classList.remove('open'); document.querySelector('#sideBackdrop').classList.remove('open'); });
  await sleep(400);
  await page.evaluate(() => {
    const now = Date.now();
    localStorage.setItem('u-msgs', JSON.stringify([{ id: 'dm_a', type: 'dm', text: '冒昧打扰一下，你那边今天下雨了吗，我这边下了一整天。', createdAt: now - 60000, read: false, user: { name: '栗子汽水', handle: 'lizi', key: 'u_lizi' } }]));
  });
  await page.click('.tab[data-tab="dm"]'); await sleep(900); await shot('r3-dm.png');
  await page.click('.tab[data-tab="search"]'); await sleep(500);
  await page.fill('#searchInput', '好'); await sleep(800); await shot('r3-search.png');
  await page.click('.tab[data-tab="home"]'); await sleep(600);
  const p0 = await page.$('.post'); if (p0) { await p0.click(); await sleep(900); await shot('r3-detail.png'); }
  console.log(JSON.stringify({ nPosts, errs }));
  await browser.close(); site.close(); srv.kill();
})().catch((e) => { console.log('ERR ' + e); process.exit(2); });
