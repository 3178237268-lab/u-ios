const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = 'D:/deepseek/gouzuoqu/U';
const PORT = 18930;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  fs.readFile(f, (e, buf) => {
    if (e) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
});

const log = [];
const ok = (n, c, extra) => { log.push((c ? 'PASS ' : 'FAIL ') + n + (extra ? ' | ' + extra : '')); return c; };
const sleep = (n) => new Promise(r => setTimeout(r, n));

(async () => {
  await new Promise(r => srv.listen(PORT, r));
  const posts = await (await fetch('http://127.0.0.1:8787/api/posts')).json();
  const list = posts.posts || posts;
  const target = (list || []).find(p => (p.media || []).filter(m => m.type === 'video').length > 1);
  if (!target) { console.log('no multi-video post'); process.exit(1); }
  const pid = 'srv_' + target.id;
  const total = target.media.length;

  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:' + PORT + '/index.html');
  await page.evaluate(() => localStorage.setItem('u-server', 'http://127.0.0.1:8787'));
  await page.reload();
  await page.click('#guestBtn');
  await sleep(1800);
  await page.waitForSelector('.post[data-id="' + pid + '"]', { timeout: 8000 });
  await page.evaluate((id) => { const el = document.querySelector('.post[data-id="' + id + '"]'); if (el) el.scrollIntoView({ block: 'center' }); }, pid);
  await sleep(500);
  await page.evaluate((id) => {
    const art = document.querySelector('.post[data-id="' + id + '"]');
    const b = art.querySelector('.pmedia .vgexp') || art.querySelector('.pmedia .vplayer');
    b.click();
  }, pid);
  await page.waitForSelector('#mediaViewer.open', { timeout: 6000 });
  await sleep(1500);

  const st0 = await page.evaluate(() => ({
    video: document.querySelector('#mediaViewer').classList.contains('video'),
    vswipe: document.querySelector('#mediaViewer').classList.contains('vswipe'),
    count: document.querySelector('#mvCount').textContent,
    paused: document.querySelector('#mvContent video').paused,
    ctlOp: getComputedStyle(document.querySelector('.mv-ctl')).opacity
  }));
  ok('打开查看器是视频且可上下滑', st0.video && st0.vswipe, JSON.stringify(st0));

  // 点画面 → 暂停 + 收起按键
  const box = await page.locator('#mvStage').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await sleep(60);
  await page.mouse.up();
  await sleep(500);
  const st1 = await page.evaluate(() => ({
    chromeOff: document.querySelector('#mediaViewer').classList.contains('chrome-off'),
    paused: document.querySelector('#mvContent video').paused,
    ctlOp: getComputedStyle(document.querySelector('.mv-ctl')).opacity,
    ovOp: getComputedStyle(document.querySelector('.mv-overlay')).opacity,
    botOp: getComputedStyle(document.querySelector('.mv-bot')).opacity,
    ctlPE: getComputedStyle(document.querySelector('.mv-ctl')).pointerEvents
  }));
  ok('点一下画面：暂停', st1.paused, JSON.stringify(st1));
  ok('点一下画面：下方按键隐藏', st1.chromeOff && parseFloat(st1.ctlOp) < 0.05 && parseFloat(st1.ovOp) < 0.05 && parseFloat(st1.botOp) < 0.05, JSON.stringify(st1));
  ok('隐藏后按键不可点', st1.ctlPE === 'none', st1.ctlPE);

  // 再点一下 → 恢复显示 + 继续播放
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await sleep(60);
  await page.mouse.up();
  await sleep(700);
  const st2 = await page.evaluate(() => ({
    chromeOff: document.querySelector('#mediaViewer').classList.contains('chrome-off'),
    paused: document.querySelector('#mvContent video').paused,
    ctlOp: getComputedStyle(document.querySelector('.mv-ctl')).opacity
  }));
  ok('再点一下：显示按键并继续播放', !st2.chromeOff && !st2.paused && parseFloat(st2.ctlOp) > 0.9, JSON.stringify(st2));

  // 进度条更好拖
  const sc = await page.evaluate(() => {
    const s = document.querySelector('.mv-scrub').getBoundingClientRect();
    const p = document.querySelector('.mv-prog').getBoundingClientRect();
    const k = document.querySelector('.mv-prog s');
    const ks = k ? getComputedStyle(k) : null;
    return { sw: s.width, sh: s.height, sy: s.y, ph: p.height, pw: p.width, px: p.x, py: p.y, knobScale: ks ? ks.transform : '', knobW: k ? k.getBoundingClientRect().width : 0, x: s.x, y: s.y, w: s.width };
  });
  ok('进度条热区变高变粗', sc.sh >= 24 && sc.ph >= 5, JSON.stringify(sc));
  ok('滑块常显', sc.knobW >= 12, 'knobW=' + sc.knobW + ' scale=' + sc.knobScale);

  // 按住条中间直接跳
  const before = await page.evaluate(() => document.querySelector('#mvContent video').currentTime);
  await page.mouse.move(sc.x + sc.w * 0.62, sc.y + sc.sh / 2);
  await page.mouse.down();
  await sleep(220);
  const mid = await page.evaluate(() => ({ t: document.querySelector('#mvContent video').currentTime, paused: document.querySelector('#mvContent video').paused, drag: document.querySelector('.mv-scrub').classList.contains('drag'), scr: document.querySelector('#mvOverlay').classList.contains('scrubbing') }));
  await page.mouse.move(sc.x + sc.w * 0.78, sc.y + sc.sh / 2);
  await sleep(160);
  const mid2 = await page.evaluate(() => document.querySelector('#mvContent video').currentTime);
  await page.mouse.up();
  await sleep(400);
  ok('拖进度条立即定位', mid.t > before + 5 || Math.abs(mid.t - before) > 8, 'before=' + before.toFixed(1) + ' mid=' + mid.t.toFixed(1) + ' mid2=' + mid2.toFixed(1));
  ok('拖动时暂停并出现拖动态', mid.paused && mid.drag && mid.scr, JSON.stringify(mid));

  // 上下滑：1:1 跟手
  const vh = (await page.evaluate(() => document.querySelector('#mvContent').getBoundingClientRect().height)) || 700;
  await page.evaluate(() => { const v = document.querySelector('#mvContent video'); if (v) v.play().catch(() => {}); });
  await sleep(300);
  const cy2 = box.y + box.height * 0.45;
  await page.mouse.move(cx, cy2);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) { await page.mouse.move(cx, cy2 - i * 20); await sleep(24); }
  const dragSt = await page.evaluate(() => {
    const b = document.querySelector('#mvContent');
    return { tf: b.style.transform, op: b.style.opacity };
  });
  const m1 = /translateY\((-?[\d.]+)px\)/.exec(dragSt.tf || '');
  const ty = m1 ? parseFloat(m1[1]) : 0;
  ok('拖动时 1:1 跟手（-120px 左右）', ty < -100 && ty > -145, 'transform=' + dragSt.tf + ' opacity=' + dragSt.op);
  await page.mouse.up();
  await sleep(900);
  const st3 = await page.evaluate(() => ({
    count: document.querySelector('#mvCount').textContent,
    tf: document.querySelector('#mvContent').style.transform,
    op: document.querySelector('#mvContent').style.opacity,
    playing: !document.querySelector('#mvContent video').paused
  }));
  ok('上滑切到下一个视频', st3.count.indexOf('2/') === 0, st3.count + ' of ' + total);
  ok('切完复位并自动播放', (st3.tf === '' || st3.tf === 'translateY(0px)') && parseFloat(st3.op) > 0.9 && st3.playing, JSON.stringify(st3));

  // 下滑回上一个
  await page.mouse.move(cx, cy2);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) { await page.mouse.move(cx, cy2 + i * 20); await sleep(24); }
  await page.mouse.up();
  await sleep(900);
  const st4 = await page.evaluate(() => document.querySelector('#mvCount').textContent);
  ok('下滑回上一个视频', st4.indexOf('1/') === 0, st4);

  // 轻拖（不够阈值）回弹
  await page.mouse.move(cx, cy2);
  await page.mouse.down();
  for (let i = 1; i <= 4; i++) { await page.mouse.move(cx, cy2 - i * 6); await sleep(30); }
  await page.mouse.up();
  await sleep(600);
  const st5 = await page.evaluate(() => ({ count: document.querySelector('#mvCount').textContent, tf: document.querySelector('#mvContent').style.transform }));
  ok('轻拖回弹不切视频', st5.count.indexOf('1/') === 0 && (st5.tf === 'translateY(0px)' || st5.tf === ''), JSON.stringify(st5));

  // 点播放按钮仍然有效（不触发收起）
  await page.evaluate(() => { const b = document.querySelector('[data-mvact="playpause"]'); if (b) b.click(); });
  await sleep(400);
  const st6 = await page.evaluate(() => ({ chromeOff: document.querySelector('#mediaViewer').classList.contains('chrome-off'), paused: document.querySelector('#mvContent video').paused }));
  ok('点控制条暂停键不会收起浮层', !st6.chromeOff && st6.paused, JSON.stringify(st6));

  ok('无 pageerror', errs.length === 0, errs.join(' | ').slice(0, 300));

  await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/mv60-bar.png' });
  await page.evaluate(() => { const b = document.querySelector('[data-mvact="playpause"]'); if (b) b.click(); });
  await sleep(400);
  await page.mouse.move(cx, cy); await page.mouse.down(); await sleep(50); await page.mouse.up();
  await sleep(500);
  await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/mv60-hidden.png' });

  console.log(log.join('\n'));
  console.log('SUMMARY ' + log.filter(x => x.startsWith('PASS')).length + '/' + log.length);
  await browser.close();
  srv.close();
  process.exit(0);
})().catch(e => { console.log('FATAL ' + e.message); console.log(log.join('\n')); process.exit(1); });
