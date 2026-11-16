const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = 'D:/deepseek/gouzuoqu/U';
const PORT = 18931;
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
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:' + PORT + '/index.html');
  await page.evaluate(() => localStorage.setItem('u-server', 'http://127.0.0.1:8787'));
  await page.reload();
  await sleep(800);
  await page.fill('#authUser', 'admin123');
  await page.fill('#authPass', 'admin123');
  await page.click('#authSubmit');
  await sleep(3000);
  const pid = await page.evaluate(() => {
    const arts = Array.from(document.querySelectorAll('.post'));
    const hit = arts.find(a => a.querySelectorAll('.vplayer.vgrid').length >= 2);
    return hit ? hit.dataset.id : null;
  });
  ok('信息流里有多视频帖', !!pid, String(pid));
  if (!pid) { console.log(log.join('\n')); await browser.close(); srv.close(); process.exit(1); }
  await page.evaluate((id) => { const el = document.querySelector('.post[data-id="' + id + '"]'); if (el) el.scrollIntoView({ block: 'center' }); }, pid);
  await sleep(600);
  await page.evaluate((id) => {
    const art = document.querySelector('.post[data-id="' + id + '"]');
    const b = art.querySelector('.vgexp') || art.querySelector('.vplayer');
    b.click();
  }, pid);
  await page.waitForSelector('#mediaViewer.open', { timeout: 8000 });
  await sleep(1800);

  const st0 = await page.evaluate(() => ({
    video: document.querySelector('#mediaViewer').classList.contains('video'),
    vswipe: document.querySelector('#mediaViewer').classList.contains('vswipe'),
    count: document.querySelector('#mvCount').textContent,
    paused: document.querySelector('#mvContent video').paused,
    ctlOp: getComputedStyle(document.querySelector('.mv-ctl')).opacity
  }));
  ok('打开查看器是视频且可上下滑', st0.video && st0.vswipe, JSON.stringify(st0));

  const box = await page.locator('#mvStage').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down(); await sleep(60); await page.mouse.up();
  await sleep(520);
  const st1 = await page.evaluate(() => ({
    chromeOff: document.querySelector('#mediaViewer').classList.contains('chrome-off'),
    paused: document.querySelector('#mvContent video').paused,
    ctlOp: getComputedStyle(document.querySelector('.mv-ctl')).opacity,
    ovOp: getComputedStyle(document.querySelector('.mv-overlay')).opacity,
    botOp: getComputedStyle(document.querySelector('.mv-bot')).opacity,
    ctlPE: getComputedStyle(document.querySelector('.mv-ctl')).pointerEvents
  }));
  ok('点一下画面：视频暂停', st1.paused, JSON.stringify(st1));
  ok('点一下画面：下方按键与浮层隐藏', st1.chromeOff && parseFloat(st1.ctlOp) < 0.05 && parseFloat(st1.ovOp) < 0.05 && parseFloat(st1.botOp) < 0.05, JSON.stringify(st1));
  ok('隐藏后控件不可点', st1.ctlPE === 'none', st1.ctlPE);
  await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/mv60-hidden.png' });

  await page.mouse.move(cx, cy); await page.mouse.down(); await sleep(60); await page.mouse.up();
  await sleep(800);
  const st2 = await page.evaluate(() => ({
    chromeOff: document.querySelector('#mediaViewer').classList.contains('chrome-off'),
    paused: document.querySelector('#mvContent video').paused,
    ctlOp: getComputedStyle(document.querySelector('.mv-ctl')).opacity
  }));
  ok('再点一下：按键恢复且继续播放', !st2.chromeOff && !st2.paused && parseFloat(st2.ctlOp) > 0.9, JSON.stringify(st2));

  const sc = await page.evaluate(() => {
    const s = document.querySelector('.mv-scrub').getBoundingClientRect();
    const p = document.querySelector('.mv-prog').getBoundingClientRect();
    const k = document.querySelector('.mv-prog s');
    const kr = k.getBoundingClientRect();
    return { sh: s.height, ph: p.height, knobW: kr.width, sx: s.x, sy: s.y, sw: s.width };
  });
  ok('进度条热区与粗细加大', sc.sh >= 24 && sc.ph >= 5, JSON.stringify(sc));
  ok('滑块常显', sc.knobW >= 12, 'knobW=' + sc.knobW);
  await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/mv60-bar.png' });

  const before = await page.evaluate(() => document.querySelector('#mvContent video').currentTime);
  await page.mouse.move(sc.sx + sc.sw * 0.62, sc.sy + sc.sh / 2);
  await page.mouse.down();
  await sleep(240);
  const mid = await page.evaluate(() => ({ t: document.querySelector('#mvContent video').currentTime, paused: document.querySelector('#mvContent video').paused, drag: document.querySelector('.mv-scrub').classList.contains('drag'), scr: document.querySelector('#mvOverlay').classList.contains('scrubbing') }));
  await page.mouse.move(sc.sx + sc.sw * 0.8, sc.sy + sc.sh / 2);
  await sleep(200);
  const mid2 = await page.evaluate(() => document.querySelector('#mvContent video').currentTime);
  await page.mouse.up();
  await sleep(500);
  ok('按住进度条 62% 立即定位', Math.abs(mid.t - before) > 1 || mid.t > 1, 'before=' + before.toFixed(1) + ' mid=' + mid.t.toFixed(1) + ' mid2=' + mid2.toFixed(1));
  ok('拖动时暂停/拖动态正确', mid.paused && mid.drag && mid.scr, JSON.stringify(mid));
  ok('继续拖到 80% 继续前进', mid2 > mid.t, mid.t.toFixed(1) + ' -> ' + mid2.toFixed(1));

  const cy2 = box.y + box.height * 0.45;
  await page.mouse.move(cx, cy2);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) { await page.mouse.move(cx, cy2 - i * 20); await sleep(26); }
  const dragSt = await page.evaluate(() => {
    const b = document.querySelector('#mvContent');
    return { tf: b.style.transform, op: b.style.opacity };
  });
  const m1 = /translateY\((-?[\d.]+)px\)/.exec(dragSt.tf || '');
  const ty = m1 ? parseFloat(m1[1]) : 0;
  ok('拖动时内容 1:1 跟手', ty < -100 && ty > -145, 'transform=' + dragSt.tf + ' opacity=' + dragSt.op);
  await page.mouse.up();
  await sleep(1000);
  const st3 = await page.evaluate(() => ({
    count: document.querySelector('#mvCount').textContent,
    tf: document.querySelector('#mvContent').style.transform,
    op: document.querySelector('#mvContent').style.opacity,
    playing: !document.querySelector('#mvContent video').paused
  }));
  ok('上滑切到下一个视频', st3.count.indexOf('2/') === 0, st3.count);
  ok('切完复位并自动播放', (st3.tf === '' || st3.tf === 'translateY(0px)') && parseFloat(st3.op) > 0.9 && st3.playing, JSON.stringify(st3));

  await page.mouse.move(cx, cy2);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) { await page.mouse.move(cx, cy2 + i * 20); await sleep(26); }
  await page.mouse.up();
  await sleep(1000);
  const st4 = await page.evaluate(() => document.querySelector('#mvCount').textContent);
  ok('下滑回上一个视频', st4.indexOf('1/') === 0, st4);

  await page.mouse.move(cx, cy2);
  await page.mouse.down();
  for (let i = 1; i <= 4; i++) { await page.mouse.move(cx, cy2 - i * 6); await sleep(32); }
  await page.mouse.up();
  await sleep(700);
  const st5 = await page.evaluate(() => ({ count: document.querySelector('#mvCount').textContent, tf: document.querySelector('#mvContent').style.transform }));
  ok('轻拖回弹不切视频', st5.count.indexOf('1/') === 0 && (st5.tf === 'translateY(0px)' || st5.tf === ''), JSON.stringify(st5));

  await page.evaluate(() => { const b = document.querySelector('[data-mvact="playpause"]'); if (b) b.click(); });
  await sleep(500);
  const st6 = await page.evaluate(() => ({ chromeOff: document.querySelector('#mediaViewer').classList.contains('chrome-off'), paused: document.querySelector('#mvContent video').paused }));
  ok('点控制条暂停键不收起浮层', !st6.chromeOff && st6.paused, JSON.stringify(st6));

  ok('无 pageerror', errs.length === 0, errs.join(' | ').slice(0, 300));
  console.log(log.join('\n'));
  console.log('SUMMARY ' + log.filter(x => x.startsWith('PASS')).length + '/' + log.length);
  await browser.close();
  srv.close();
  process.exit(0);
})().catch(e => { console.log('FATAL ' + e.message); console.log(log.join('\n')); process.exit(1); });
