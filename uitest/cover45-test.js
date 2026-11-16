const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const ROOT = 'D:/deepseek/gouzuoqu/U';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 18855;
const API = 'http://127.0.0.1:8787';
const NEW_POSTERS = ['196b69d6a97b4fcc8e22ca43','9f33701f47b1412dafe2f59d','2f784afa09ac1cd85ff44706'];

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  const ext = path.extname(f);
  const type = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.js' ? 'text/javascript' : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const b = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox','--disable-gpu'] });
  const ctx = await b.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:' + PORT + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((api) => localStorage.setItem('u-server', api), API);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.click('#guestBtn').catch(() => {});
  await page.waitForTimeout(4000);

  const info = await page.evaluate((ids) => {
    const out = { posterAttrs: {}, gradient: {}, cells: 0 };
    document.querySelectorAll('video[data-mid]').forEach(v => {
      const mid = v.dataset.mid;
      const p = v.getAttribute('poster') || '';
      out.posterAttrs[mid] = p;
      const card = v.closest('.vplayer');
      if (card) out.gradient[mid] = getComputedStyle(card).backgroundImage.slice(0, 60);
    });
    ids.forEach(id => {});
    out.cells = document.querySelectorAll('.pmedia .vplayer.vgrid').length;
    return out;
  }, NEW_POSTERS);

  // measure brightness of each new poster
  const bright = await page.evaluate(async (ids) => {
    const res = {};
    for (const id of ids) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = 'http://127.0.0.1:8787/media/' + id;
      await img.decode().catch(() => {});
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || 1; c.height = img.naturalHeight || 1;
      const cx = c.getContext('2d');
      cx.drawImage(img, 0, 0);
      let mean = -1;
      try {
        const d = cx.getImageData(0, 0, c.width, c.height).data;
        let s = 0, n = 0;
        for (let i = 0; i < d.length; i += 4 * 53) { s += d[i]*0.299 + d[i+1]*0.587 + d[i+2]*0.114; n++; }
        mean = n ? Math.round(s / n) : -1;
      } catch (e) { mean = -2; }
      res[id] = { w: img.naturalWidth, h: img.naturalHeight, mean };
    }
    return res;
  }, NEW_POSTERS);

  console.log(JSON.stringify({ errs, cells: info.cells, posterAttrs: info.posterAttrs, gradient: info.gradient, bright }, null, 1));
  await page.screenshot({ path: path.join(ROOT, 'uitest/cover45.png'), fullPage: false });
  await b.close();
  server.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
