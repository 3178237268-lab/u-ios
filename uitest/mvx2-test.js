
const http = require('node:http'); const fs = require('node:fs'); const path = require('node:path');
const { chromium } = require('playwright-core');
const ROOT = 'D:/deepseek/gouzuoqu/U'; const PORT = 18852;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
const log = [];
(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await page.goto('http://127.0.0.1:' + PORT + '/index.html');
  await page.evaluate(() => { localStorage.setItem('u-server','http://127.0.0.1:8787'); localStorage.setItem('u-theme','dark'); });
  await page.reload(); await page.waitForTimeout(1500);
  await page.evaluate(() => { const b=document.querySelector('#guestBtn'); if(b) b.click(); });
  await page.waitForTimeout(4000);

  const reveal = await page.evaluate(() => {
    let n = 0;
    document.querySelectorAll('.pveil-btn').forEach(b => { if (/显示/.test(b.textContent)) { b.click(); n++; } });
    return n;
  });
  await page.waitForTimeout(1200);
  const afterReveal = await page.evaluate(() => ({ stages: document.querySelectorAll('.pmedia .vplayer .vstage').length, vexpand: document.querySelectorAll('.pmedia .vgexp').length }));

  const opened = await page.evaluate(() => {
    const exp = document.querySelector('.pmedia .vgexp');
    if (exp) { exp.click(); return 'vexp'; }
    const st = document.querySelector('.pmedia .vplayer .vstage');
    if (st) { st.click(); return 'stage'; }
    return 'none';
  });
  await page.waitForTimeout(2500);

  const info = await page.evaluate(() => {
    const txt = s => { const e = document.querySelector(s); return e ? e.textContent.trim() : null; };
    const rect = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) }; };
    return {
      viewerOpen: document.querySelector('#mediaViewer').classList.contains('open'),
      videoClass: document.querySelector('#mediaViewer').classList.contains('video'),
      overlayKids: document.querySelector('#mvOverlay').children.length,
      authorName: txt('#mvOverlay .mv-name'), handle: txt('#mvOverlay .mv-handle'), follow: txt('#mvOverlay .mv-follow'),
      pills: Array.from(document.querySelectorAll('#mvOverlay .mv-pill')).map(b => b.className.replace('mv-pill','').trim() + '|' + b.textContent.trim()),
      rounds: document.querySelectorAll('#mvOverlay .mv-round').length,
      ctl: Array.from(document.querySelectorAll('#mvOverlay .mv-cbtn')).map(b => b.dataset.mvact + '|' + b.textContent.trim()),
      remain: txt('#mvOverlay .mv-remain'), speed: txt('#mvOverlay .mv-speed'),
      videoRect: rect('#mvContent video'), overlayRect: rect('#mvOverlay'),
      oldCtrl: (() => { const c = document.querySelector('#mvContent .vctrl'); return c ? getComputedStyle(c).display : null; })(),
      progW: (() => { const i = document.querySelector('#mvOverlay .mv-prog i'); return i ? i.style.width : null; })(),
      overlayBg: (() => { const o = document.querySelector('#mvOverlay'); return o ? getComputedStyle(o).backgroundImage.slice(0, 60) : null; })(),
    };
  });

  const speed1 = await page.evaluate(() => { document.querySelector('#mvOverlay [data-mvact="speed"]').click(); return { label: document.querySelector('#mvOverlay .mv-speed').textContent.trim(), rate: document.querySelector('#mvContent video').playbackRate }; });
  const speed2 = await page.evaluate(() => { document.querySelector('#mvOverlay [data-mvact="speed"]').click(); return { label: document.querySelector('#mvOverlay .mv-speed').textContent.trim(), rate: document.querySelector('#mvContent video').playbackRate }; });
  const muted = await page.evaluate(() => { document.querySelector('#mvOverlay [data-mvact="mute"]').click(); return document.querySelector('#mvContent video').muted; });
  const paused = await page.evaluate(() => { document.querySelector('#mvOverlay [data-mvact="playpause"]').click(); return document.querySelector('#mvContent video').paused; });
  const playing = await page.evaluate(() => { document.querySelector('#mvOverlay [data-mvact="playpause"]').click(); return !document.querySelector('#mvContent video').paused; });

  const likeBefore = await page.evaluate(() => { const b = document.querySelector('#mvOverlay .mv-pill.like'); return b.className + '|' + b.textContent.trim(); });
  await page.evaluate(() => { document.querySelector('#mvOverlay [data-mvact="like"]').click(); });
  await page.waitForTimeout(1500);
  const likeAfter = await page.evaluate(() => { const b = document.querySelector('#mvOverlay .mv-pill.like'); return b.className + '|' + b.textContent.trim(); });

  const followBefore = await page.evaluate(() => document.querySelector('#mvOverlay .mv-follow') ? document.querySelector('#mvOverlay .mv-follow').textContent.trim() : null);
  const followAfter = await page.evaluate(() => { const b = document.querySelector('#mvOverlay .mv-follow'); if (!b) return null; b.click(); return document.querySelector('#mvOverlay .mv-follow').textContent.trim(); });

  const countBefore = await page.evaluate(() => document.querySelector('#mvCount').textContent);
  await page.evaluate(() => { document.querySelector('#mvOverlay [data-mvact="next"]').click(); });
  await page.waitForTimeout(1500);
  const countAfter = await page.evaluate(() => document.querySelector('#mvCount').textContent);
  const pillsAfter = await page.evaluate(() => document.querySelectorAll('#mvOverlay .mv-pill').length);
  await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/mvx.png' });

  console.log(JSON.stringify({ reveal, afterReveal, opened, info, speed1, speed2, muted, paused, playing, likeBefore, likeAfter, followBefore, followAfter, countBefore, countAfter, pillsAfter, errs }, null, 1));
  await browser.close(); server.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
