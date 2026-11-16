
const { chromium } = require('playwright-core');
const path = require('node:path');
const API = 'http://127.0.0.1:8787', WEB = 'http://127.0.0.1:8765';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const r = await fetch(API + '/api/posts?limit=30').then((x) => x.json());
  const posts = r.posts || r.items || [];
  const mediaCheck = [];
  for (const p of posts) for (const m of (p.media || [])) if (String(m.mime || '').startsWith('video/')) mediaCheck.push({ vid: m.id, poster: m.poster || '', ratio: m.ratio || 0 });
  const head = [];
  for (const m of mediaCheck.slice(0, 5)) if (m.poster) { const u = API + m.poster; const res = await fetch(u, { method: 'GET' }); head.push({ poster: m.poster.slice(0, 24), status: res.status, type: res.headers.get('content-type'), len: (await res.arrayBuffer()).byteLength }); }
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
  const cdp = await page.context().newCDPSession(page); await cdp.send('Network.enable');
  const urls = [];
  cdp.on('Network.requestWillBeSent', (e) => { const u = e.request.url || ''; if (u.includes('/media/')) urls.push(u.split('/media/')[1].slice(0, 30)); });
  await page.goto(WEB + '/', { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => { const b = document.querySelector('#guestBtn'); if (b) b.click(); });
  await sleep(6000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.5));
  await sleep(3000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(800);
  const dom = await page.evaluate(() => Array.from(document.querySelectorAll('.pmedia .vplayer')).map((vp) => { const v = vp.querySelector('video'); const t = vp.querySelector('.vtime'); return { vid: vp.dataset.vid, cls: vp.className.replace('vplayer', '').trim(), poster: (v && v.getAttribute('poster') || '').slice(-26), src: (v && v.getAttribute('src') || '').slice(-18), rs: v ? v.readyState : -1, time: t ? t.textContent : '' }; }));
  const box = await page.evaluate(() => { const el = document.querySelector('.post'); if (!el) return null; el.scrollIntoView(); const r = el.getBoundingClientRect(); return { x: r.x, y: Math.max(0, r.y), w: r.width, h: Math.min(700, r.height) }; });
  if (box) await page.screenshot({ path: path.join(__dirname, '..', '.tmp-test', 'cover-after.png'), clip: { x: box.x, y: box.y, width: box.w, height: box.h } });
  console.log(JSON.stringify({ posts: posts.length, mediaCheck, posterHeads: head, mediaUrls: Array.from(new Set(urls)), dom, errs }));
  await browser.close();
})().catch((e) => console.log(JSON.stringify({ fatal: String(e).slice(0, 300) })));
