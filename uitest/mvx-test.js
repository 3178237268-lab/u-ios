
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');

const ROOT = 'D:/deepseek/gouzuoqu/U';
const PORT = 18850;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:' + PORT + '/index.html');
  await page.evaluate(() => { localStorage.setItem('u-server', 'http://127.0.0.1:8787'); localStorage.setItem('u-theme', 'dark'); });
  await page.reload();
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const b = document.querySelector('#guestBtn'); if (b) b.click(); });
  await page.waitForTimeout(3000);

  // 展开 18+ 遮罩
  for (let i = 0; i < 4; i++) {
    const btn = await page.$('.post .pmedia .reveal-btn, .post .pmedia button');
    await page.evaluate(() => {
      document.querySelectorAll('.post').forEach(p => {
        const b = Array.from(p.querySelectorAll('.pmedia button')).find(x => /显示/.test(x.textContent));
        if (b) b.click();
      });
    });
    await page.waitForTimeout(600);
  }

  const gridCount = await page.evaluate(() => document.querySelectorAll('.post .pmedia .vplayer').length);
  // 点第一个视频格
  const opened = await page.evaluate(() => {
    const vp = document.querySelector('.post .pmedia .vplayer .vstage');
    if (!vp) return 'no-stage';
    vp.click();
    return 'clicked';
  });
  await page.waitForTimeout(2500);

  const info = await page.evaluate(() => {
    const viewer = document.querySelector('#mediaViewer');
    const ov = document.querySelector('#mvOverlay');
    const cs = el => el ? getComputedStyle(el) : null;
    const txt = sel => { const e = document.querySelector(sel); return e ? e.textContent.trim() : null; };
    return {
      viewerOpen: !!viewer && viewer.classList.contains('open'),
      videoClass: !!viewer && viewer.classList.contains('video'),
      overlayKids: ov ? ov.children.length : 0,
      authorName: txt('#mvOverlay .mv-name'),
      handle: txt('#mvOverlay .mv-handle'),
      followBtn: txt('#mvOverlay .mv-follow'),
      pills: Array.from(document.querySelectorAll('#mvOverlay .mv-pill')).map(b => b.className + ':' + b.textContent.trim()),
      rounds: document.querySelectorAll('#mvOverlay .mv-round').length,
      ctlBtns: Array.from(document.querySelectorAll('#mvOverlay .mv-cbtn')).map(b => b.dataset.mvact + ':' + b.textContent.trim()),
      remain: txt('#mvOverlay .mv-remain'),
      speed: txt('#mvOverlay .mv-speed'),
      videoRect: (() => { const v = document.querySelector('#mvContent video'); if (!v) return null; const r = v.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) }; })(),
      overlayRect: (() => { const o = document.querySelector('#mvOverlay'); if (!o) return null; const r = o.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height) }; })(),
      oldCtrlVisible: (() => { const c = document.querySelector('#mvContent .vctrl'); return c ? getComputedStyle(c).display : null; })(),
      errs: []
    };
  });

  // 交互：倍速 → 静音 → 播放/暂停 → 下一个
  await page.evaluate(() => { document.querySelector('#mvOverlay [data-mvact="speed"]').click(); });
  const speed1 = await page.evaluate(() => ({ label: document.querySelector('#mvOverlay .mv-speed').textContent.trim(), rate: document.querySelector('#mvContent video').playbackRate }));
  await page.evaluate(() => { document.querySelector('#mvOverlay [data-mvact="speed"]').click(); });
  const speed2 = await page.evaluate(() => ({ label: document.querySelector('#mvOverlay .mv-speed').textContent.trim(), rate: document.querySelector('#mvContent video').playbackRate }));
  await page.evaluate(() => { document.querySelector('#mvOverlay [data-mvact="mute"]').click(); });
  const muted = await page.evaluate(() => document.querySelector('#mvContent video').muted);
  await page.evaluate(() => { document.querySelector('#mvOverlay [data-mvact="playpause"]').click(); });
  const paused = await page.evaluate(() => document.querySelector('#mvContent video').paused);
  await page.evaluate(() => { document.querySelector('#mvOverlay [data-mvact="playpause"]').click(); });
  const playing = await page.evaluate(() => !document.querySelector('#mvContent video').paused);

  // 点赞同步
  const likeBefore = await page.evaluate(() => document.querySelector('#mvOverlay .mv-pill.like').className + '|' + document.querySelector('#mvOverlay .mv-pill.like').textContent.trim());
  await page.evaluate(() => { document.querySelector('#mvOverlay [data-mvact="like"]').click(); });
  await page.waitForTimeout(1200);
  const likeAfter = await page.evaluate(() => document.querySelector('#mvOverlay .mv-pill.like').className + '|' + document.querySelector('#mvOverlay .mv-pill.like').textContent.trim());

  const countBefore = await page.evaluate(() => document.querySelector('#mvCount').textContent);
  await page.evaluate(() => { document.querySelector('#mvOverlay [data-mvact="next"]').click(); });
  await page.waitForTimeout(1500);
  const countAfter = await page.evaluate(() => document.querySelector('#mvCount').textContent);
  const afterNext = await page.evaluate(() => ({ overlay: document.querySelectorAll('#mvOverlay .mv-pill').length, idx: document.querySelector('#mvCount').textContent }));

  await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/mvx.png' });

  console.log(JSON.stringify({ gridCount, opened, info, speed1, speed2, muted, paused, playing, likeBefore, likeAfter, countBefore, countAfter, afterNext, errs }, null, 1));
  await browser.close();
  server.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
