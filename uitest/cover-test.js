
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'cover-data');
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const PORT = 18950, SITE = 18781, S = 'http://127.0.0.1:' + PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18780', U_DATA_DIR: DATA }, stdio: 'ignore' });
const site = http.createServer((req, res) => {
  fs.readFile(path.join(ROOT, 'index.html'), (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(b); });
}).listen(SITE);
(async () => {
  for (let i = 0; i < 90; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });

  // 1) 造一个 3 秒 webm 视频（Chrome recordVideo）和一个 jpg 封面
  const ctx = await browser.newContext({ viewport: { width: 480, height: 270 }, recordVideo: { dir: path.join(__dirname, 'rec'), size: { width: 480, height: 270 } } });
  const pg = await ctx.newPage();
  await pg.setContent('<body style="margin:0;background:#123"><canvas id="c" width="480" height="270"></canvas><script>const x=document.getElementById("c").getContext("2d");let t=0;setInterval(()=>{t++;x.fillStyle="hsl("+(t*7%360)+",70%,50%)";x.fillRect(0,0,480,270);x.fillStyle="#fff";x.font="bold 60px sans-serif";x.fillText("U VIDEO",90,150)},40)</script></body>');
  await sleep(3200);
  const vidPath = await pg.video().path();
  await ctx.close();
  const webm = fs.readFileSync(vidPath);

  const up = async (buf, mime, name) => {
    const r = await fetch(S + '/api/media', { method: 'POST', headers: { 'content-type': mime, 'x-filename': name }, body: buf });
    return r.json();
  };
  await fetch(S + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }) });
  let login = await fetch(S + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }) }).then((r) => r.json());
  if (!login.token) login = await fetch(S + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin123', password: 'admin123' }) }).then((r) => r.json());
  const token = login.token;
  if (!token) { console.log(JSON.stringify({ fatal: 'no token', login })); return; }
  const v = await up(webm, 'video/webm', 'clip.webm');
  // jpg 封面：用 canvas 截一张
  const p2 = await browser.newPage({ viewport: { width: 480, height: 270 } });
  await p2.setContent('<canvas id="c" width="480" height="270"></canvas><script>const x=document.getElementById("c").getContext("2d");const g=x.createLinearGradient(0,0,480,270);g.addColorStop(0,"#0af");g.addColorStop(1,"#f0a");x.fillStyle=g;x.fillRect(0,0,480,270);x.fillStyle="#fff";x.font="bold 48px sans-serif";x.fillText("COVER",150,155)</script>');
  const jpg = await p2.evaluate(() => document.getElementById('c').toDataURL('image/jpeg', 0.9).split(',')[1]);
  await p2.close();
  const p = await up(Buffer.from(jpg, 'base64'), 'image/jpeg', 'poster.jpg');
  const post = await fetch(S + '/api/posts', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify({ text: '封面测试', media: [{ id: v.id, poster: p.id, ratio: 480 / 270 }] }) }).then((r) => r.json());

  // 2) 客户端看到什么
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
  await page.goto('http://127.0.0.1:' + SITE + '/', { waitUntil: 'load' });
  await page.evaluate(() => { localStorage.setItem('u-server', 'http://127.0.0.1:18950'); });
  await page.evaluate(() => { const b = document.querySelector('#guestBtn'); if (b) b.click(); });
  await sleep(3000);
  const info = await page.evaluate(() => {
    const vids = [...document.querySelectorAll('.pmedia video, .vstage video')];
    return vids.map((v) => ({ poster: v.getAttribute('poster') || '', hasSrc: !!(v.getAttribute('src') || v.currentSrc), size: v.dataset.size, ratio: v.dataset.ratio, w: Math.round(v.getBoundingClientRect().width), h: Math.round(v.getBoundingClientRect().height) }));
  });
  const mediaResp = await fetch(S + '/api/posts?limit=5').then((r) => r.json());
  const m = (mediaResp.posts && mediaResp.posts[0] && mediaResp.posts[0].media) || [];
  const st = await page.evaluate(async (srcs) => {
    const out = {};
    for (const u of srcs) { const r = await fetch(u); out[u] = r.status + ' ' + (r.headers.get('content-type') || ''); }
    return out;
  }, [v.url, p.url]);
  console.log(JSON.stringify({ postOk: !!post.id, mediaApi: m, vids: info, mediaStatus: st, errs }));
  await browser.close();
})().catch((e) => console.log(JSON.stringify({ fatal: String(e).slice(0, 300) }))).finally(() => { site.close(); srv.kill(); });
