
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'm9-data');
fs.rmSync(DATA, { recursive: true, force: true });
fs.mkdirSync(DATA, { recursive: true });
const PORT = 18931, SITE = 18831;
const S = 'http://127.0.0.1:' + PORT, PAGE = 'http://127.0.0.1:' + SITE + '/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18731', U_DATA_DIR: DATA }, stdio: 'ignore' });
const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const file = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p);
  fs.readFile(file, (e, buf) => {
    if (e) { res.writeHead(404); res.end('no'); return; }
    res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
    res.end(buf);
  });
}).listen(SITE);
let pass = 0, fail = 0;
function ok(c, n, x) { if (c) { pass++; } else { fail++; console.log('FAIL ' + n + ' :: ' + JSON.stringify(x)); } }
const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPDIzM//AABEIAAEAAQMBIgACEQEDEQH/xAAfAAABBQEBAQEBAQAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/aAAwDAQACEQMRAD8A/v4//9k=', 'base64');

async function api(pathname, opts) {
  const r = await fetch(S + pathname, opts);
  let body = null;
  try { body = await r.json(); } catch (e) { body = null; }
  return { ok: r.ok, status: r.status, body: body };
}

(async () => {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }
  const cfg = await api('/api/config');
  ok(cfg.body && cfg.body.settings && Number(cfg.body.settings.mediaMaxPerPost) === 9, 'config mediaMaxPerPost=9', cfg.body && cfg.body.settings && cfg.body.settings.mediaMaxPerPost);

  const login = await api('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin123', password: 'admin123' }) });
  const tok = login.body && login.body.token;
  ok(!!tok, 'admin login', login.status);
  const auth = { authorization: 'Bearer ' + tok };

  /* 上传 9 个视频 + 每个补封面 */
  const media = [];
  for (let i = 0; i < 9; i++) {
    const up = await api('/api/media', { method: 'POST', headers: { ...auth, 'content-type': 'video/mp4', 'X-Filename': 'u-t' + i + '.mp4' }, body: Buffer.from('AAAA' + i) });
    const id = up.body && up.body.id;
    if (!id) { ok(false, 'upload video ' + i, up); continue; }
    const pos = await api('/api/media/' + id + '/poster', { method: 'POST', headers: { ...auth, 'content-type': 'image/jpeg', 'X-Ratio': '0.5625' }, body: JPG });
    media.push({ id: id, poster: pos.body && pos.body.poster, ratio: 0.5625 });
  }
  ok(media.length === 9, 'uploaded 9 videos with posters', media.length);

  const tooMany = await api('/api/posts', { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ text: 'x', media: media.concat([{ id: media[0].id }]) }) });
  ok(tooMany.status === 400 && /最多 9 个/.test(String(tooMany.body && tooMany.body.error)), '10 media rejected with 最多 9', tooMany);

  const created = await api('/api/posts', { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ text: '九宫格视频测试', media: media }) });
  const pid = created.body && created.body.post && created.body.post.id;
  ok(!!pid && (created.body.post.media || []).length === 9, 'post with 9 media accepted', created.body && created.body.post && (created.body.post.media || []).length);

  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 220)));
  await page.goto(PAGE, { waitUntil: 'load', timeout: 40000 });
  await page.evaluate((s) => localStorage.setItem('u-server', s), S);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1600);
  await page.click('#guestBtn').catch(() => {});
  await page.waitForTimeout(2600);

  const maxOnPage = await page.evaluate(() => localStorage.getItem('u-media-max'));
  ok(maxOnPage === '9', 'page applied MEDIA_MAX 9 (localStorage)', maxOnPage);

  const hint = await page.evaluate(() => { const el = document.querySelector('#composeHint') || document.querySelector('.compose-tools .hint'); return el ? el.textContent : ''; });
  ok(hint.indexOf('最多 9 个') >= 0, 'compose hint says 最多 9 个', hint.slice(0, 80));

  const count = await page.evaluate(() => { const el = document.querySelector('#mediaCount'); return el ? el.textContent : ''; });
  ok(count === '0/9', 'compose counter 0/9', count);

  const tiles = await page.evaluate(() => {
    const box = document.querySelector('.pmedia.mm');
    if (!box) return { n: 0, cls: 'none' };
    return { n: box.querySelectorAll('.vplayer.vgrid').length, cls: box.className, exp: box.querySelectorAll('.vgexp').length };
  });
  ok(tiles.n === 9 && /\bmm\b/.test(tiles.cls), 'post renders 9 vgrid tiles', tiles);
  ok(tiles.exp === 9, 'each tile has expand button', tiles.exp);

  /* 点第 9 个方块：应打开查看器 9/9 */
  const last = page.locator('.pmedia.mm .vplayer.vgrid .vstage').nth(8);
  await last.scrollIntoViewIfNeeded();
  await last.click({ force: true });
  await page.waitForTimeout(700);
  let view = await page.evaluate(() => { const b = document.querySelector('#mediaViewer'); return { open: !!(b && b.classList.contains('open')), cnt: (document.querySelector('#mvCount') || {}).textContent || '', next: (document.querySelector('#mvNext') || {}).disabled }; });
  ok(view.open && view.cnt === '9/9', 'click 9th tile opens viewer 9/9', view);
  ok(view.next === true, 'next disabled at last', view.next);
  await page.click('#mvClose').catch(() => {});
  await page.waitForTimeout(500);

  /* 点第 5 个方块的放大按钮：查看器 5/9 */
  const fifth = page.locator('.pmedia.mm .vplayer.vgrid .vgexp').nth(4);
  await fifth.scrollIntoViewIfNeeded();
  await fifth.click({ force: true });
  await page.waitForTimeout(700);
  view = await page.evaluate(() => { const b = document.querySelector('#mediaViewer'); return { open: !!(b && b.classList.contains('open')), cnt: (document.querySelector('#mvCount') || {}).textContent || '' }; });
  ok(view.open && view.cnt === '5/9', 'expand on 5th tile opens 5/9', view);

  /* 查看器里往后翻到 9/9 */
  for (let i = 0; i < 4; i++) { await page.click('#mvNext').catch(() => {}); await page.waitForTimeout(180); }
  const endCnt = await page.evaluate(() => (document.querySelector('#mvCount') || {}).textContent || '');
  ok(endCnt === '9/9', 'viewer can step to 9/9', endCnt);
  const dots = await page.evaluate(() => document.querySelectorAll('#mvDots .mv-dot').length);
  ok(dots === 9, 'viewer shows 9 dots', dots);

  const size = await page.evaluate(() => { const t = document.querySelector('.pmedia.mm .vplayer.vgrid'); const r = t ? t.getBoundingClientRect() : null; return r ? { w: Math.round(r.width), h: Math.round(r.height) } : null; });
  ok(size && size.w > 60 && Math.abs(size.w - size.h) <= 2, 'grid tile is square', size);

  ok(errs.length === 0, 'no pageerror', errs.slice(0, 3));
  console.log('RESULT ' + pass + '/' + (pass + fail));
  await browser.close();
  srv.kill();
  site.close();
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) {}
  process.exit(0);
})().catch((e) => { console.log('ERR ' + (e && e.stack || e)); try { srv.kill(); } catch (_) {} process.exit(1); });