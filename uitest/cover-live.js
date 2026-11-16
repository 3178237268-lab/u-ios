
const { chromium } = require('playwright-core');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const SITE = 18783;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const site = http.createServer((req, res) => {
  fs.readFile(path.join(ROOT, 'index.html'), (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(b); });
}).listen(SITE);
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  const cdp = await page.context().newCDPSession(page); await cdp.send('Network.enable');
  let mediaBytes = 0, mediaReqs = 0;
  cdp.on('Network.requestWillBeSent', (e) => { if ((e.request.url || '').includes('/media/')) mediaReqs++; });
  cdp.on('Network.loadingFinished', (e) => { mediaBytes += e.encodedDataLength || 0; });
  await page.goto('http://127.0.0.1:' + SITE + '/', { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => { localStorage.setItem('u-server', 'http://127.0.0.1:8787'); localStorage.removeItem('u-server-token'); });
  await page.evaluate(() => { const b = document.querySelector('#guestBtn'); if (b) b.click(); });
  await sleep(7000);
  const info = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.pmedia .vplayer').forEach((vp) => {
      const v = vp.querySelector('video'); if (!v) return;
      const t = vp.querySelector('.vtime');
      out.push({ vid: vp.dataset.vid, poster: (v.getAttribute('poster') || '').slice(-28), src: (v.getAttribute('src') || '').slice(-42), rs: v.readyState, vw: v.videoWidth, vh: v.videoHeight, dur: Math.round(v.duration || 0), time: t ? t.textContent : '', w: Math.round(v.getBoundingClientRect().width), h: Math.round(v.getBoundingClientRect().height) });
    });
    return out;
  });
  const first = await page.evaluate(() => { const vp = document.querySelector('.pmedia .vplayer'); if (!vp) return null; const r = vp.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  if (first) await page.screenshot({ path: path.join(ROOT, '.tmp-test', 'cover-live.png'), clip: { x: first.x, y: first.y, width: first.w, height: Math.min(first.h, 400) } });
  const painted = await page.evaluate(() => {
    const v = document.querySelector('.pmedia .vplayer video'); if (!v) return null;
    const c = document.createElement('canvas'); c.width = 120; c.height = 68;
    try { c.getContext('2d').drawImage(v, 0, 0, 120, 68); const d = c.getContext('2d').getImageData(0, 0, 120, 68).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; return { avg: Math.round(s / (d.length / 4) / 3) }; } catch (e) { return { err: String(e).slice(0, 60) }; }
  });
  console.log(JSON.stringify({ info, mediaReqs, mediaBytes, painted, errs }));
  await browser.close();
})().catch((e) => console.log(JSON.stringify({ fatal: String(e).slice(0, 200) }))).finally(() => site.close());
