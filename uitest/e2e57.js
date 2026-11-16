
const { chromium } = require('playwright-core');
const path = require('path');
const SITE = 'http://127.0.0.1:8765/index.html';
const API = 'http://127.0.0.1:8787';
const MARK = 'E2E57 六视频跨用户可见性';
const shot = (n) => 'D:/deepseek/gouzuoqu/U/.tmp-test/' + n + '.png';

async function login(page, user, pass) {
  await page.goto(SITE, { waitUntil: 'load' });
  await page.evaluate((s) => { localStorage.setItem('u-server', s); }, API);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(900);
  await page.fill('#authUser', user);
  await page.fill('#authPass', pass);
  await page.click('#authSubmit');
  await page.waitForTimeout(2600);
  return page.evaluate(() => !!document.querySelector('.user-ava,.pcomposer,#feedList .post'));
}

(async () => {
  const out = { steps: [], errs: [], bad: [] };
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required'] });
  try {
    /* 建第二个用户 */
    await fetch(API + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'viewer57', password: 'viewer123', nickname: '旁观者57' }) }).catch(() => {});

    /* A：管理员发 6 视频 + 18+ */
    const ctxA = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
    const A = await ctxA.newPage();
    A.on('pageerror', e => out.errs.push('A ' + String(e).slice(0, 160)));
    A.on('console', m => { if (m.type() === 'error') out.bad.push('A-console ' + m.text().slice(0, 160)); });
    A.on('response', r => { if (r.status() >= 400) out.bad.push('A ' + r.status() + ' ' + r.url().slice(0, 90)); });
    out.steps.push('loginA=' + await login(A, 'admin123', 'admin123'));
    await A.click('#composeBtn');
    await A.waitForTimeout(600);
    await A.fill('#composeText', MARK);
    const files = [1,2,3,4,5,6].map(i => 'D:/deepseek/gouzuoqu/U/.tmp-test/e2e/v' + i + '.mp4');
    await A.setInputFiles('#filePicker', files);
    await A.waitForFunction(() => /6\s*\/\s*9/.test((document.getElementById('mediaCount')||{}).textContent||''), null, { timeout: 120000 });
    out.steps.push('mediaCount=' + await A.$eval('#mediaCount', e => e.textContent.trim()));
    await A.click('#sensRow');
    await A.waitForTimeout(200);
    out.steps.push('sensChecked=' + await A.$eval('#composeSensitive', e => e.checked));
    await A.click('#composePublish');
    await A.waitForFunction(() => !document.getElementById('compose').classList.contains('open'), null, { timeout: 180000 });
    out.steps.push('composeClosed');
    await A.waitForTimeout(1500);

    const posts = await (await fetch(API + '/api/posts?limit=50')).json();
    const list = posts.items || posts.posts || [];
    const mine = list.find(p => (p.text || '').indexOf(MARK) >= 0);
    out.postId = mine && mine.id;
    out.server = mine ? { sens: mine.sensitive, media: (mine.media || []).map(m => ({ id: m.id, mime: m.mime, poster: !!(m.poster && m.poster.length), ratio: m.ratio })) } : null;
    await A.screenshot({ path: shot('e2e57-a-post') });

    /* B：另一个用户看这条帖子 */
    const ctxB = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
    const B = await ctxB.newPage();
    B.on('pageerror', e => out.errs.push('B ' + String(e).slice(0, 160)));
    B.on('console', m => { if (m.type() === 'error') out.bad.push('B-console ' + m.text().slice(0, 160)); });
    B.on('response', r => { if (r.status() >= 400) out.bad.push('B ' + r.status() + ' ' + r.url().slice(0, 90)); });
    out.steps.push('loginB=' + await login(B, 'viewer57', 'viewer123'));
    await B.waitForTimeout(3000);

    const found = await B.evaluate((mark) => {
      const p = Array.from(document.querySelectorAll('.post')).find(a => (a.textContent || '').indexOf(mark) >= 0);
      if (!p) return { ok: false };
      p.scrollIntoView({ block: 'center' });
      return { ok: true, id: p.dataset.id, grid: p.querySelectorAll('.pmedia .vplayer.vgrid').length, veil: !!p.querySelector('.pveil'), cls: (p.querySelector('.pmedia') || {}).className };
    }, MARK);
    out.bSees = found;
    await B.screenshot({ path: shot('e2e57-b-veil') });

    if (found.ok) {
      /* 18+ 显示 */
      if (found.veil) { await B.click('.post[data-id="' + found.id + '"] .pveil-btn'); await B.waitForTimeout(700); }
      out.bAfterReveal = await B.evaluate((id) => {
        const p = document.querySelector('.post[data-id="' + id + '"]');
        const pm = p.querySelector('.pmedia');
        return { cls: pm.className, veil: !!p.querySelector('.pveil'), grid: p.querySelectorAll('.vplayer.vgrid').length };
      }, found.id);
      /* 封面能解码吗 */
      out.posters = await B.evaluate(async (id) => {
        const p = document.querySelector('.post[data-id="' + id + '"]');
        const res = [];
        for (const v of Array.from(p.querySelectorAll('.vplayer.vgrid video'))) {
          const src = v.getAttribute('poster') || '';
          const one = { has: !!src, abs: /^https?:\/\//.test(src) };
          if (src) {
            one.load = await new Promise((res2) => { const im = new Image(); im.onload = () => res2(im.naturalWidth + 'x' + im.naturalHeight); im.onerror = () => res2('ERR'); im.src = src; setTimeout(() => res2('TIMEOUT'), 8000); });
          }
          res.push(one);
        }
        return res;
      }, found.id);
      await B.screenshot({ path: shot('e2e57-b-shown') });

      /* 点第一个格子直接播 */
      await B.click('.post[data-id="' + found.id + '"] .vplayer.vgrid:nth-of-type(1) .vstage', { position: { x: 60, y: 60 } });
      await B.waitForTimeout(2500);
      out.inline = await B.evaluate((id) => {
        const v = document.querySelector('.post[data-id="' + id + '"] .vplayer.vgrid video');
        return { t: +(v.currentTime || 0).toFixed(2), w: v.videoWidth, rs: v.readyState, paused: v.paused, err: v.error && v.error.code };
      }, found.id);

      /* 放大页 */
      await B.click('.post[data-id="' + found.id + '"] .vplayer.vgrid:nth-of-type(1) .vgexp');
      await B.waitForTimeout(2500);
      out.viewer = await B.evaluate(() => {
        const v = document.querySelector('#mvContent video');
        return { open: document.getElementById('mediaViewer').classList.contains('open'), count: (document.getElementById('mvCount')||{}).textContent, vw: v ? v.videoWidth : -1, t: v ? +v.currentTime.toFixed(2) : -1, overlay: document.querySelectorAll('#mvOverlay .mv-pill').length, err: v && v.error && v.error.code };
      });
      await B.screenshot({ path: shot('e2e57-b-viewer') });
      await B.click('#mvClose');
      await B.waitForTimeout(400);
    }

    /* 刷新一次，确认封面不是一次性缓存 */
    await B.reload({ waitUntil: 'load' });
    await B.waitForTimeout(4500);
    out.afterReload = await B.evaluate((mark) => {
      const p = Array.from(document.querySelectorAll('.post')).find(a => (a.textContent || '').indexOf(mark) >= 0);
      if (!p) return { found: false };
      return { found: true, grid: p.querySelectorAll('.vplayer.vgrid').length, posters: Array.from(p.querySelectorAll('video')).map(v => v.getAttribute('poster') ? 'y' : 'n').join('') };
    }, MARK);
  } catch (e) {
    out.errs.push('FATAL ' + String(e.message || e).slice(0, 300));
  } finally {
    await browser.close().catch(() => {});
    console.log(JSON.stringify(out, null, 1).slice(0, 6000));
  }
})();
