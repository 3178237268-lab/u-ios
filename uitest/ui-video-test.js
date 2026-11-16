
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'ui-data');
fs.rmSync(DATA, { recursive: true, force: true });
fs.mkdirSync(DATA, { recursive: true });
const PORT = 18907;
const S = 'http://127.0.0.1:' + PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const srv = spawn(process.execPath, ['src/server.js'], {
  cwd: path.join(ROOT, 'server'),
  env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18796', U_DATA_DIR: DATA },
  stdio: 'ignore'
});

let pass = 0, fail = 0;
function ok(c, name, extra) { if (c) pass++; else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra) : '')); } }

(async () => {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }

  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));

  await page.goto('http://127.0.0.1:8765/', { waitUntil: 'load', timeout: 40000 });
  await page.evaluate((s) => { localStorage.setItem('u-server', s); }, S);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await page.click('#guestBtn').catch(() => {});
  await page.waitForTimeout(2500);

  const token = await page.evaluate(() => localStorage.getItem('u-server-token'));
  ok(!!token, 'guest token', token && token.slice(0, 6));

  /* 通过接口发一条带封面的视频帖 */
  async function up(buf, name, mime) {
    const r = await fetch(S + '/api/media', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'X-Filename': name, 'Content-Type': mime }, body: buf });
    return (await r.json()).id;
  }
  const vid = await up(Buffer.alloc(4096, 9), 'clip.mp4', 'video/mp4');
  const poster = await up(Buffer.alloc(1024, 5), 'cover.jpg', 'image/jpeg');
  const pr = await fetch(S + '/api/posts', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: '封面测试帖', media: [{ id: vid, poster: poster, ratio: 0.5625 }] }) });
  ok(pr.status === 201, 'api post created', pr.status);

  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);

  const v = await page.evaluate((base) => {
    const ply = document.querySelector('.vplayer');
    const vidEl = ply && ply.querySelector('video');
    const speed = document.querySelector('.vspeed');
    const buf = document.querySelector('.vbuf');
    const time = document.querySelector('.vtime');
    const item = document.querySelector('.side-item');
    const av = document.querySelector('.side-head .avatar');
    const cs = (el) => el ? getComputedStyle(el) : null;
    return {
      players: document.querySelectorAll('.vplayer').length,
      poster: vidEl ? (vidEl.getAttribute('poster') || '') : '',
      hasBuf: !!buf,
      bufBg: buf ? cs(buf).backgroundColor : '',
      speedBg: speed ? cs(speed).backgroundColor : '',
      time: time ? time.textContent : '',
      itemFont: item ? cs(item).fontSize : '',
      itemSvg: item && item.querySelector('svg') ? cs(item.querySelector('svg')).width : '',
      avW: av ? cs(av).width : '',
      base: base
    };
  }, S);

  ok(v.players > 0, 'video card rendered', v.players);
  ok(v.poster.indexOf(S + '/media/') === 0, 'feed uses server poster', v.poster);
  ok(v.hasBuf, 'buffer bar in DOM');
  ok(/rgba\(255, 255, 255, 0\.34\)/.test(v.bufBg), 'buffer bar color', v.bufBg);
  ok(/rgba\(255, 255, 255, 0\.14\)/.test(v.speedBg), 'speed button dark', v.speedBg);
  ok(!/^\d{1,2}\/\d{1,2}/.test(v.time.trim()), 'time not a date', v.time);
  ok(v.itemFont === '17.5px', 'drawer item font', v.itemFont);
  ok(v.itemSvg === '23px', 'drawer icon size', v.itemSvg);
  ok(v.avW === '70px', 'drawer avatar size', v.avW);

  /* 5 秒静默刷新：等 6 秒，看 /api/posts 是否被再次请求，且页面没有弹 toast */
  let hits = 0;
  page.on('request', (r) => { if (r.url().indexOf(S + '/api/posts?limit=') === 0) hits++; });
  await page.waitForTimeout(6000);
  ok(hits >= 1, 'silent 5s resync hits', hits);
  const toasts = await page.evaluate(() => document.querySelectorAll('.toast.on, .toast.show').length);
  ok(toasts === 0, 'no toast during silent sync', toasts);

  console.log(JSON.stringify({ pass, fail, errs: errs.slice(0, 5), sample: v }));
  await browser.close();
  srv.kill();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('ERR ' + (e && e.stack || e)); try { srv.kill(); } catch (x) {} process.exit(2); });
