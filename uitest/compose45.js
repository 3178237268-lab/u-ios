const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const ROOT = 'D:/deepseek/gouzuoqu/U';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 18857;
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  const ext = path.extname(f);
  res.writeHead(200, { 'Content-Type': ext === '.html' ? 'text/html; charset=utf-8' : ext === '.js' ? 'text/javascript' : 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise(r => server.listen(PORT, r));
  const b = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox','--disable-gpu'] });
  const page = await (await b.newContext({ viewport: { width: 420, height: 900 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:' + PORT + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.setItem('u-server', 'http://127.0.0.1:8787'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.click('#guestBtn').catch(() => {});
  await page.waitForTimeout(2000);
  await page.click('#composeBtn').catch(() => {});
  await page.waitForTimeout(800);
  const added = await page.evaluate(async () => {
    const r = await fetch('http://127.0.0.1:8787/media/f4ab87e0abb1af42bc238cc7');
    const blob = await r.blob();
    const file = new File([blob], 'ok.mp4', { type: 'video/mp4' });
    const dt = new DataTransfer();
    dt.items.add(file);
    const inp = document.getElementById('filePicker');
    inp.files = dt.files;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return { size: blob.size, type: blob.type };
  });
  await page.waitForTimeout(4000);
  const state = await page.evaluate(() => {
    const prev = document.querySelector('#composePreview, .preview-grid');
    const hint = Array.from(document.querySelectorAll('span,div')).map(e => e.textContent || '').filter(t => /^\d+\/\d+$/.test(t.trim()));
    const imgs = document.querySelectorAll('.preview-grid img, .preview-grid video').length;
    const toasts = Array.from(document.querySelectorAll('.toast, .u-toast')).map(e => e.textContent).filter(Boolean);
    return { counter: hint, previewCells: imgs, toasts };
  });
  console.log(JSON.stringify({ errs, added, state }, null, 1));
  await b.close(); server.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
