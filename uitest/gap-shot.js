
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'gap-data');
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const PORT = 18932, SITE = 18779;
const S = 'http://127.0.0.1:' + PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18778', U_DATA_DIR: DATA }, stdio: 'ignore' });
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
  for (const t of ['冒昧打扰一下，你那边今天下雨了吗，我这边下了一整天。', '路过小学门口，听见放学的铃声。', '今天的晚霞好看得不像话。', '耳机随机播到一首很久没听的歌，瞬间回到大学。']) await mk(t);
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.goto('http://127.0.0.1:' + SITE + '/', { waitUntil: 'load', timeout: 40000 });
  await page.evaluate(([s, t, u]) => { localStorage.setItem('u-server', s); localStorage.setItem('u-server-token', t); localStorage.setItem('u-server-user', JSON.stringify(u)); localStorage.removeItem('u-dm-hidden'); }, [S, tok, reg.user]);
  await page.reload({ waitUntil: 'load' }); await sleep(3000);
  const shot = (n) => page.screenshot({ path: path.join(ROOT, '.tmp-test', n) });
  const m = await page.evaluate(() => {
    const cs = (sel, prop) => { const el = document.querySelector(sel); return el ? getComputedStyle(el)[prop] : null; };
    const posts = [...document.querySelectorAll('.post')];
    let gap = null;
    if (posts.length > 1) gap = Math.round(posts[1].getBoundingClientRect().top - posts[0].getBoundingClientRect().bottom);
    return { posts: posts.length, gap, postPad: cs('.post', 'padding'), postMargin: cs('.post', 'marginBottom'), searchMargin: cs('.search-box', 'marginBottom'), ntab: cs('.ntabs', 'marginBottom') };
  });
  await shot('g-home.png');
  await page.evaluate(() => { const now = Date.now(); localStorage.setItem('u-msgs', JSON.stringify([{ id: 'dm_a', type: 'dm', text: '冒昧打扰一下，你那边今天下雨了吗，我这边下了一整天。', createdAt: now - 60000, read: false, user: { name: '栗子汽水', handle: 'lizi', key: 'u_lizi' } }, { id: 'dm_b', type: 'dm', text: '第二个会话', createdAt: now - 300000, read: true, user: { name: '小满', handle: 'xiaoman', key: 'u_xm' } }])); });
  await page.click('.tab[data-tab="dm"]'); await sleep(900); await shot('g-dm.png');
  await page.click('.tab[data-tab="search"]'); await sleep(700); await shot('g-search.png');
  console.log(JSON.stringify({ m, errs }));
  await browser.close(); site.close(); srv.kill();
})().catch((e) => { console.log('ERR ' + e); process.exit(2); });
