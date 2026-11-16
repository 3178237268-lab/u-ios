
const http = require('node:http'); const fs = require('node:fs'); const path = require('node:path');
const { chromium } = require('playwright-core');
const ROOT = 'D:/deepseek/gouzuoqu/U'; const PORT = 18853;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0,160)));
  await page.goto('http://127.0.0.1:' + PORT + '/index.html');
  await page.evaluate(() => { localStorage.setItem('u-server','http://127.0.0.1:8787'); localStorage.setItem('u-theme','dark'); });
  await page.reload(); await page.waitForTimeout(1500);
  await page.evaluate(() => { const b=document.querySelector('#guestBtn'); if(b) b.click(); });
  await page.waitForTimeout(4000);
  await page.evaluate(() => { document.querySelectorAll('.pveil-btn').forEach(b => { if (/显示/.test(b.textContent)) b.click(); }); });
  await page.waitForTimeout(1200);

  // 单视频帖（自带 vctrl 那个）
  const single = await page.evaluate(() => {
    const vp = document.querySelector('.post .pmedia .vplayer:not(.vgrid)');
    if (!vp) return 'no-single';
    const btn = vp.querySelector('[data-vact="expand"]') || vp.querySelector('.vexpand');
    if (btn) { btn.click(); return 'vexp'; }
    const st = vp.querySelector('.vstage'); if (st) { st.click(); return 'stage'; }
    return 'none';
  });
  await page.waitForTimeout(2000);
  const singleInfo = await page.evaluate(() => ({ count: document.querySelector('#mvCount').textContent, pills: document.querySelectorAll('#mvOverlay .mv-pill').length, kids: document.querySelector('#mvOverlay').children.length }));
  await page.evaluate(() => { document.querySelector('#mvClose').click(); });
  await page.waitForTimeout(600);

  // 图片帖
  const imgOpen = await page.evaluate(() => {
    const img = document.querySelector('.post .pmedia img');
    if (!img) return 'no-img';
    img.click();
    return 'ok';
  });
  await page.waitForTimeout(900);
  const imgInfo = await page.evaluate(() => ({
    open: document.querySelector('#mediaViewer').classList.contains('open'),
    videoClass: document.querySelector('#mediaViewer').classList.contains('video'),
    overlayKids: document.querySelector('#mvOverlay').children.length,
    hasImg: !!document.querySelector('#mvContent>img')
  }));
  console.log(JSON.stringify({ single, singleInfo, imgOpen, imgInfo, errs }, null, 1));
  await browser.close(); server.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
