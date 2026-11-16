
const http = require('node:http'); const fs = require('node:fs'); const path = require('node:path');
const { chromium } = require('playwright-core');
const ROOT = 'D:/deepseek/gouzuoqu/U'; const PORT = 18851;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
  page.on('pageerror', e => console.log('PAGEERR', String(e).slice(0,200)));
  await page.goto('http://127.0.0.1:' + PORT + '/index.html');
  await page.evaluate(() => { localStorage.setItem('u-server','http://127.0.0.1:8787'); localStorage.setItem('u-theme','dark'); });
  await page.reload(); await page.waitForTimeout(1500);
  await page.evaluate(() => { const b=document.querySelector('#guestBtn'); if(b) b.click(); });
  await page.waitForTimeout(4000);
  const d = await page.evaluate(() => {
    const posts = Array.from(document.querySelectorAll('.post')).slice(0,6);
    return {
      postCount: document.querySelectorAll('.post').length,
      feedText: (document.querySelector('#feedList')||{}).textContent ? document.querySelector('#feedList').textContent.slice(0,120) : null,
      posts: posts.map(p => ({
        id: p.dataset.id,
        media: p.querySelectorAll('.pmedia').length,
        vplayers: p.querySelectorAll('.pmedia .vplayer').length,
        imgs: p.querySelectorAll('.pmedia img').length,
        btns: Array.from(p.querySelectorAll('.pmedia button')).map(b => (b.className||'') + '=' + b.textContent.trim().slice(0,6)),
        txt: (p.textContent||'').slice(0,40)
      }))
    };
  });
  console.log(JSON.stringify(d, null, 1));
  await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/mvx-probe.png' });
  await browser.close(); server.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
