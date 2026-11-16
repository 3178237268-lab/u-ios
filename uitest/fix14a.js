const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
const BASE = 'http://127.0.0.1:8787';
const APP = 'http://127.0.0.1:8765/';

const results = [];
function ok(n) { results.push(['PASS', n]); console.log('PASS ' + n); }
function bad(n, why) { results.push(['FAIL', n + ' :: ' + why]); console.log('FAIL ' + n + ' :: ' + why); }

async function api(path, opts) {
  const r = await fetch(BASE + path, opts);
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, body: j };
}

(async () => {
  const u = 'fix' + Date.now().toString().slice(-6);
  const pw = 'pass1234';
  const reg = await api('/api/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: pw, nickname: u })
  });
  const tok = reg.body && reg.body.token;
  if (!tok) { bad('register', JSON.stringify(reg.body).slice(0, 80)); process.exit(1); }
  const fs2 = require('fs');
  const png = fs2.readFileSync('D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\testimg.png');
  const up = await api('/api/media', {
    method: 'POST', headers: { 'Content-Type': 'image/png', Authorization: 'Bearer ' + tok, 'X-Filename': 'p.png' }, body: png
  });
  const mediaId = up.body && up.body.id;
  const post = await api('/api/posts', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
    body: JSON.stringify({ text: 'my18post ' + u, sensitive: true, private: false, media: [mediaId] })
  });
  const postId = post.body && post.body.post && post.body.post.id;
  if (!postId) { bad('create sensitive post', JSON.stringify(post.body).slice(0, 100)); process.exit(1); }
  console.log('postId', postId);

  const b = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader']
  });
  const ctx = await b.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + String(e).slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 160)); });
  await p.goto(APP, { waitUntil: 'load' });
  await wait(2200);
  await p.locator('#authUser').fill(u);
  await p.locator('#authPass').fill(pw);
  await p.locator('#authSubmit').click();
  await wait(2600);

  /* 1. open profile */
  try {
    await p.evaluate(() => {
      document.querySelector('#sideDrawer').classList.add('open');
      document.querySelector('#sideBackdrop').classList.add('open');
    });
    await wait(500);
    await p.locator('#sideAvatar').click({ force: true });
    await wait(1800);
    const on = await p.evaluate(() => !!document.querySelector('#viewProfile.on'));
    on ? ok('profile opens') : bad('profile opens', 'viewProfile not on');
  } catch (e) { bad('profile opens', e.message.slice(0, 90)); }

  /* 2. reveal */
  try {
    await p.evaluate((pid) => {
      const art = document.querySelector('#viewProfile .post[data-id="' + pid + '"]') ||
        document.querySelector('#viewProfile .post[data-id="srv_' + pid + '"]');
      if (art) art.scrollIntoView({ block: 'center' });
    }, postId);
    await wait(500);
    await p.evaluate((pid) => {
      const art = document.querySelector('#viewProfile .post[data-id="' + pid + '"]') ||
        document.querySelector('#viewProfile .post[data-id="srv_' + pid + '"]');
      const btn = art && art.querySelector('.pveil-btn');
      if (btn) btn.click();
    }, postId);
    await wait(900);
    const st = await p.evaluate((pid) => {
      const art = document.querySelector('#viewProfile .post[data-id="' + pid + '"]') ||
        document.querySelector('#viewProfile .post[data-id="srv_' + pid + '"]');
      const veil = art && art.querySelector('.pveil');
      const btn = art && art.querySelector('.pveil-btn');
      const img = art && art.querySelector('.pmedia img');
      return {
        hideMode: !!(veil && veil.classList.contains('hide-mode')),
        label: btn ? btn.textContent.trim() : '',
        imgW: img ? img.naturalWidth : 0,
        mediaPrivate: !!(art && art.querySelector('.pmedia.private'))
      };
    }, postId);
    if (st.hideMode && st.label.indexOf('\u9690\u85cf') >= 0 && st.imgW > 0 && !st.mediaPrivate) ok('profile reveal shows image');
    else bad('profile reveal shows image', JSON.stringify(st));
  } catch (e) { bad('profile reveal shows image', e.message.slice(0, 90)); }

  /* 3. hide again */
  try {
    await p.evaluate((pid) => {
      const art = document.querySelector('#viewProfile .post[data-id="' + pid + '"]') ||
        document.querySelector('#viewProfile .post[data-id="srv_' + pid + '"]');
      const btn = art && art.querySelector('.pveil-btn');
      if (btn) btn.click();
    }, postId);
    await wait(800);
    const st = await p.evaluate((pid) => {
      const art = document.querySelector('#viewProfile .post[data-id="' + pid + '"]') ||
        document.querySelector('#viewProfile .post[data-id="srv_' + pid + '"]');
      const veil = art && art.querySelector('.pveil');
      const btn = art && art.querySelector('.pveil-btn');
      return {
        hideMode: !!(veil && veil.classList.contains('hide-mode')),
        label: btn ? btn.textContent.trim() : '',
        privateCls: !!(art && art.querySelector('.pmedia.private'))
      };
    }, postId);
    if (!st.hideMode && st.label.indexOf('\u663e\u793a') >= 0 && st.privateCls) ok('profile hide blurs again');
    else bad('profile hide blurs again', JSON.stringify(st));
  } catch (e) { bad('profile hide blurs again', e.message.slice(0, 90)); }

  /* 4. open detail from profile */
  try {
    await p.evaluate((pid) => {
      const art = document.querySelector('#viewProfile .post[data-id="' + pid + '"]') ||
        document.querySelector('#viewProfile .post[data-id="srv_' + pid + '"]');
      const t = art && art.querySelector('.ptext');
      if (t) t.click();
    }, postId);
    await wait(1300);
    const open = await p.evaluate(() => {
      const s = document.querySelector('#postSheet');
      return { open: !!(s && (s.classList.contains('open') || s.classList.contains('on'))), hasBody: !!document.querySelector('#postBody') };
    });
    open.open && open.hasBody ? ok('profile post opens detail') : bad('profile post opens detail', JSON.stringify(open));
    if (open.open) { await p.locator('#postBack').click({ force: true }); await wait(900); }
  } catch (e) { bad('profile post opens detail', e.message.slice(0, 90)); }

  /* 5. hot rank */
  try {
    await p.locator('.tab[data-tab="search"]').click({ timeout: 6000 });
    await wait(1500);
    const hr = await p.evaluate(() => {
      const box = document.querySelector('#hotRank');
      const items = box ? Array.from(box.querySelectorAll('.hot-item')) : [];
      const sc = items.map(e => +e.querySelector('.hot-score').textContent);
      let sorted = true;
      for (let i = 1; i < sc.length; i++) if (sc[i] > sc[i - 1]) sorted = false;
      return { exists: !!box, n: items.length, sorted: sorted, first: sc[0] || 0 };
    });
    if (hr.exists && hr.n > 0 && hr.sorted) ok('hot rank ' + hr.n + ' items sorted, top=' + hr.first);
    else bad('hot rank', JSON.stringify(hr));
    if (hr.n > 0) {
      await p.locator('#hotRank .hot-item').first().click({ timeout: 6000 });
      await wait(1300);
      const opened = await p.evaluate(() => !!document.querySelector('#postSheet.open, #postSheet.on'));
      opened ? ok('hot rank item opens detail') : bad('hot rank item opens detail', 'sheet not open');
      if (opened) { await p.locator('#postBack').click({ force: true }); await wait(700); }
    }
  } catch (e) { bad('hot rank', e.message.slice(0, 90)); }

  /* 6. official delete syncs to server */
  try {
    const la = await api('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: '123456' })
    });
    const atok = la.body && la.body.token;
    if (!atok) throw new Error('admin login failed ' + JSON.stringify(la.body).slice(0, 60));
    const mk = await api('/api/posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + atok },
      body: JSON.stringify({ text: 'officialtodelete ' + Date.now() })
    });
    const oid = mk.body && mk.body.post && mk.body.post.id;
    if (!oid) throw new Error('official post failed');

    const ctx2 = await b.newContext({ viewport: { width: 430, height: 900 } });
    const p2 = await ctx2.newPage();
    await p2.goto(APP, { waitUntil: 'load' });
    await wait(2200);
    await p2.locator('#authUser').fill('admin');
    await p2.locator('#authPass').fill('123456');
    await p2.locator('#authSubmit').click();
    await wait(3200);
    await p2.evaluate((id) => {
      const art = document.querySelector('.post[data-id="srv_' + id + '"]');
      if (art) { art.scrollIntoView({ block: 'center' }); const b = art.querySelector('button[data-act="more"]'); if (b) b.click(); }
    }, oid);
    await wait(1200);
    const menuOpen = await p2.evaluate(() => {
      const m = document.querySelector('#menuSheet');
      const del = document.querySelector('#menuDelete');
      return { open: !!(m && m.classList.contains('open')), delShown: !!(del && del.style.display !== 'none'), delText: del ? del.textContent.trim() : '' };
    });
    console.log('menu', JSON.stringify(menuOpen));
    await p2.locator('#menuDelete').click({ timeout: 8000 });
    await wait(1000);
    await p2.locator('#confirmOk').click({ timeout: 8000 });
    await wait(3200);

    const after = await api('/api/posts?limit=100');
    const still = (after.body.posts || []).some(x => String(x.id) === String(oid));
    !still ? ok('official delete removes from server') : bad('official delete removes from server', 'still id ' + oid);
    await p2.close();
  } catch (e) { bad('official delete removes from server', e.message.slice(0, 110)); }

  console.log('errors', errs.length);
  errs.slice(0, 6).forEach(e => console.log('  ' + e));
  const okCount = results.filter(r => r[0] === 'PASS').length;
  console.log('RESULT ' + okCount + '/' + results.length);
  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\fix14a.png' });
  await b.close();
})();
