
const http = require('node:http'); const fs = require('node:fs'); const path = require('node:path');
const { chromium } = require('playwright-core');
const ROOT = 'D:/deepseek/gouzuoqu/U'; const PORT = 18854;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0,160)));
  await page.goto('http://127.0.0.1:' + PORT + '/index.html');
  await page.evaluate(() => { localStorage.setItem('u-server','http://127.0.0.1:8787'); localStorage.setItem('u-theme','dark'); });
  await page.reload(); await page.waitForTimeout(1500);
  await page.evaluate(() => { const b=document.querySelector('#guestBtn'); if(b) b.click(); });
  await page.waitForTimeout(3500);
  await page.evaluate(() => { const t = document.querySelector('.seg button[data-feed="talk"], [data-tab="talk"], .feed-tab'); if (t) t.click(); });
  await page.waitForTimeout(500);
  const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('.seg button, .feed-seg button, .tabs button')).map(b => (b.dataset.feed||b.dataset.tab||'') + '=' + b.textContent.trim()).slice(0,8));
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === '说说'); if (b) b.click(); });
  await page.waitForTimeout(2500);
  const st = await page.evaluate(() => ({ imgs: document.querySelectorAll('.pmedia img').length, vids: document.querySelectorAll('.pmedia .vplayer').length, posts: document.querySelectorAll('.post').length }));
  const opened = await page.evaluate(() => { const img = document.querySelector('.pmedia img'); if (!img) return 'no-img'; img.click(); return 'ok'; });
  await page.waitForTimeout(900);
  const info = await page.evaluate(() => ({
    open: document.querySelector('#mediaViewer').classList.contains('open'),
    videoClass: document.querySelector('#mediaViewer').classList.contains('video'),
    overlayKids: document.querySelector('#mvOverlay').children.length,
    hasImg: !!document.querySelector('#mvContent>img'),
    count: document.querySelector('#mvCount').textContent
  }));
  console.log(JSON.stringify({ tabs, st, opened, info, errs }, null, 1));
  await browser.close(); server.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
