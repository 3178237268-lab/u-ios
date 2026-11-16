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
  page.on('response', r => { const u = r.url(); if (r.status() >= 400 && !u.includes('/lan/') && !u.includes('/media/')) bad.push(r.status() + ' ' + u.slice(0, 90)); });
  await page.goto(URL, { waitUntil: 'domcontentloaded' }); await sleep(1200);
  if (await page.locator('#guestBtn').count()) { await page.click('#guestBtn'); await sleep(3800); }
  const st = await page.evaluate(() => ({ posts: document.querySelectorAll('.post').length, off: document.body.classList.contains('net-offline') }));
  ok('同源访问能拉到帖子', st.posts > 0, JSON.stringify(st));
  ok('没有断网提示', !st.off);
  const m = await page.evaluate(async () => {
    const j = await (await fetch('/api/posts?limit=60')).json();
    const list = j.posts || j || [];
    let vid = null;
    for (const p of list) for (const x of (p.media || [])) if (String(x.mime || x.type || '').startsWith('video')) { vid = x; break; }
    if (!vid) return { ok: false, why: 'no video id' };
    const rr = await fetch('/media/' + (vid.id || vid.mid), { headers: { Range: 'bytes=0-1023' } });
    return { ok: rr.status === 206, status: rr.status, id: vid.id };
  });
  ok('视频经同源代理 Range 206', m.ok, JSON.stringify(m));
  const api = await page.evaluate(async () => { const r = await fetch('/api/config'); return r.status; });
  ok('/api 同源可用', api === 200, String(api));
  const addr = await page.evaluate(() => { try { openApiSheet(); } catch (e) { return 'err:' + e.message; } return null; });
  await sleep(900);
  const shown = await page.evaluate(() => { const a = document.querySelector('#apiUrl'); return a ? a.textContent : 'none'; });
  ok('接口页显示真实地址（不再是占位串）', /^http:\/\/192\.168\.1\.217/.test(shown), shown);
  ok('无 pageerror', errs.length === 0, errs.join(' | ').slice(0, 160));
  ok('无非 /lan 的 4xx/5xx', bad.length === 0, bad.slice(0, 4).join(' ; '));
  await page.screenshot({ path: '.tmp-test/port61b.png' });
  console.log(log.join('\n')); console.log('SUMMARY ' + log.filter(x => x.startsWith('PASS')).length + '/' + log.length);
  await browser.close(); process.exit(0);
})().catch(e => { console.log('FATAL ' + e.message); console.log(log.join('\n')); process.exit(1); });
