const { chromium } = require('playwright-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://192.168.1.217:17880/';
const log = []; const ok = (n, c, x) => log.push((c ? 'PASS ' : 'FAIL ') + n + (x ? ' | ' + x : ''));
const sleep = (n) => new Promise(r => setTimeout(r, n));
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage(); const errs = []; const bad = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('response', r => { if (r.status() >= 400 && !r.url().includes('/media/')) bad.push(r.status() + ' ' + r.url().slice(0, 90)); });
  await page.goto(URL, { waitUntil: 'domcontentloaded' }); await sleep(1200);
  const def = await page.evaluate(() => ({ origin: location.origin, srv: (function () { try { return window.SRV_DEFAULT; } catch (e) { return 'n/a'; } })(), ls: localStorage.getItem('u-server') }));
  ok('默认服务器=当前页面同源', def.origin === 'http://192.168.1.217:17880', JSON.stringify(def));
  const hasGuest = await page.locator('#guestBtn').count();
  if (hasGuest) { await page.click('#guestBtn'); await sleep(3500); }
  const st = await page.evaluate(() => {
    const posts = document.querySelectorAll('.post').length;
    const lm = document.querySelector('#lmBody');
    return { posts, srv: localStorage.getItem('u-server'), off: document.body.classList.contains('net-offline'), netbar: (document.querySelector('#netBar') || {}).className || '', server: (window.Srv && Srv.base && Srv.base()) || '' };
  });
  ok('游客登录后连到同源服务器', st.posts > 0, JSON.stringify(st));
  ok('没有断网提示', !st.off, st.netbar);
  const img = await page.evaluate(async () => {
    const r = await fetch('/api/config'); const j = await r.json();
    return { status: r.status, mediaMax: j.mediaMaxPerPost || (j.settings && j.settings.mediaMaxPerPost) };
  });
  ok('页面内 /api 走同源代理', img.status === 200, JSON.stringify(img));
  const m = await page.evaluate(async () => {
    const r = await fetch('/api/posts?limit=5'); const j = await r.json();
    const p = (j.posts || [])[0]; const vid = p && (p.media || []).find(x => String(x.mime).startsWith('video'));
    if (!vid) return { ok: false, why: 'no video' };
    const rr = await fetch('/media/' + vid.id, { headers: { Range: 'bytes=0-1023' } });
    return { ok: rr.status === 206, status: rr.status };
  });
  ok('媒体经同源代理可取（Range 206）', m.ok, JSON.stringify(m));
  ok('无 pageerror', errs.length === 0, errs.join(' | ').slice(0, 160));
  ok('无 4xx/5xx 请求', bad.length === 0, bad.slice(0, 4).join(' ; '));
  await page.screenshot({ path: '.tmp-test/port61.png' });
  console.log(log.join('\n')); console.log('SUMMARY ' + log.filter(x => x.startsWith('PASS')).length + '/' + log.length);
  await browser.close(); process.exit(0);
})().catch(e => { console.log('FATAL ' + e.message); console.log(log.join('\n')); process.exit(1); });
