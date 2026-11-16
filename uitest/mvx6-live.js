
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0,160)));
  await page.goto('http://127.0.0.1:8765/index.html');
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const b=document.querySelector('#guestBtn'); if(b) b.click(); });
  await page.waitForTimeout(4500);
  await page.evaluate(() => { document.querySelectorAll('.pveil-btn').forEach(b => { if (/显示/.test(b.textContent)) b.click(); }); });
  await page.waitForTimeout(1500);
  const sel = await page.evaluate(() => ({ grid: document.querySelectorAll('.pmedia .vgexp').length, stage: document.querySelectorAll('.pmedia .vstage').length, single: document.querySelectorAll('.pmedia .vbtn.vexpand').length }));
  const opened = await page.evaluate(() => {
    const b = document.querySelector('.pmedia .vgexp') || document.querySelector('.pmedia .vbtn.vexpand');
    if (b) { b.click(); return 'btn'; }
    const s = document.querySelector('.pmedia .vstage'); if (s) { s.click(); return 'stage'; }
    return 'none';
  });
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => ({
    open: document.querySelector('#mediaViewer').classList.contains('open'),
    pills: Array.from(document.querySelectorAll('#mvOverlay .mv-pill')).map(b => b.textContent.trim()),
    ctl: Array.from(document.querySelectorAll('#mvOverlay .mv-cbtn')).map(b => b.dataset.mvact),
    name: (document.querySelector('#mvOverlay .mv-name')||{}).textContent,
    follow: (document.querySelector('#mvOverlay .mv-follow')||{}).textContent,
    remain: (document.querySelector('#mvOverlay .mv-remain')||{}).textContent,
    count: document.querySelector('#mvCount').textContent
  }));
  await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/mvx-live.png' });
  console.log(JSON.stringify({ sel, opened, info, errs }, null, 1));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
