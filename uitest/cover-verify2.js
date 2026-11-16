
const { chromium } = require('playwright-core');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..'); const SITE = 18784;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const site = http.createServer((q, s) => fs.readFile(path.join(ROOT, 'index.html'), (e, b) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); s.end(b); })).listen(SITE);
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
  const cdp = await page.context().newCDPSession(page); await cdp.send('Network.enable');
  const bytes = {}; let total = 0;
  cdp.on('Network.responseReceived', (e) => { const u = e.response.url || ''; if (u.includes('/media/')) bytes[u.split('/media/')[1].slice(0, 10)] = (bytes[u.split('/media/')[1].slice(0, 10)] || 0); });
  cdp.on('Network.loadingFinished', (e) => { total += e.encodedDataLength || 0; });
  await page.goto('http://127.0.0.1:' + SITE + '/', { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => { localStorage.setItem('u-server', 'http://127.0.0.1:8787'); });
  await page.evaluate(() => { const b = document.querySelector('#guestBtn'); if (b) b.click(); });
  await sleep(7000);
  const dom = await page.evaluate(() => Array.from(document.querySelectorAll('.pmedia .vplayer')).map((vp) => { const v = vp.querySelector('video'); const t = vp.querySelector('.vtime'); return { vid: vp.dataset.vid.slice(5, 13), cls: vp.className.replace('vplayer', '').trim(), poster: !!(v && v.getAttribute('poster')), src: (v && v.getAttribute('src') || '').slice(-14), rs: v ? v.readyState : -1, dur: v ? Math.round(v.duration || 0) : 0, time: t ? t.textContent : '' }; }));
  const box = await page.evaluate(() => { const el = document.querySelector('.pmedia'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: Math.min(700, r.height) }; });
  if (box && box.y < 900) await page.screenshot({ path: path.join(ROOT, '.tmp-test', 'cover-new.png'), clip: { x: 0, y: Math.max(0, box.y - 20), width: 420, height: Math.min(820, box.h + 60) } });
  const painted = await page.evaluate(() => { const v = document.querySelector('.pmedia .vplayer video'); if (!v || !v.videoWidth) return null; const c = document.createElement('canvas'); c.width = 100; c.height = 56; try { c.getContext('2d').drawImage(v, 0, 0, 100, 56); const d = c.getContext('2d').getImageData(0, 0, 100, 56).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; return Math.round(s / (d.length / 4) / 3); } catch (e) { return 'err'; } });
  console.log(JSON.stringify({ dom, painted, totalMB: Math.round(total / 1048576 * 100) / 100, errs }));
  await browser.close();
})().catch((e) => console.log(JSON.stringify({ fatal: String(e).slice(0, 200) }))).finally(() => site.close());
