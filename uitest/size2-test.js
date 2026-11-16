
const { chromium } = require('playwright-core');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const SITE = 18797;
const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const file = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p);
  fs.readFile(file, (e, buf) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(buf); });
}).listen(SITE);
let pass = 0, fail = 0;
const ok = (c, n, x) => { if (c) pass++; else { fail++; console.log('FAIL ' + n + ' :: ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.goto('http://127.0.0.1:' + SITE + '/', { waitUntil: 'load', timeout: 40000 });
  await page.waitForTimeout(1500);

  const res = await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'probeHost';
    host.style.cssText = 'position:fixed;left:0;top:0;right:0;z-index:99999;background:#0b0b0d;color:#fff;padding:14px;display:flex;flex-direction:column;gap:14px;font-family:inherit';
    host.innerHTML = [
      '<article class="post"><div class="avatar">U</div><div class="post-main">',
      '<div class="phead"><span class="pname">U 官方</span><span class="handle">@u_official</span></div>',
      '<div class="ptext">帖子正文示例</div></div></article>',
      '<div class="comment"><div class="avatar">栗</div><div class="comment-main"><div class="phead"><span class="pname">栗子汽水</span></div><div class="ptext">评论示例</div></div></div>',
      '<button class="msg-row"><div class="avatar">栗</div><div class="msg-main"><div class="msg-head">栗子汽水<span>12:30</span></div></div></button>',
      '<button class="search-user"><div class="avatar">栗</div><span class="search-user-main"><b>栗子汽水</b><span>@lizi</span></span></button>',
      '<div class="frow"><div class="avatar">栗</div><div class="frow-main">关注行</div></div>'
    ].join('');
    document.body.appendChild(host);
    const read = (sel) => {
      const el = document.querySelector('#probeHost ' + sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), fs: cs.fontSize };
    };
    return {
      postAvatar: read('.post .avatar'), phead: read('.post .phead'), pname: read('.post .pname'),
      commentAvatar: read('.comment .avatar'), commentHead: read('.comment .phead'),
      msgAvatar: read('.msg-row .avatar'), msgHead: read('.msg-head'),
      searchAvatar: read('.search-user .avatar'), searchName: read('.search-user-main b'),
      frowAvatar: read('.frow .avatar'),
      baseAvatar: (() => { const d = document.createElement('div'); d.className = 'avatar'; d.style.position = 'fixed'; d.style.left = '-999px'; document.body.appendChild(d); const cs = getComputedStyle(d); const w = d.getBoundingClientRect().width; d.remove(); return { w: Math.round(w), fs: cs.fontSize }; })()
    };
  });
  await page.screenshot({ path: path.join(ROOT, '.tmp-test', 'size-probe.png') });

  ok(res.postAvatar.w === 44 && res.postAvatar.fs === '18px', 'post avatar 44/18', res.postAvatar);
  ok(res.phead.fs === '16px', 'post head 16px', res.phead);
  ok(res.commentAvatar.w === 40 && res.commentAvatar.fs === '15px', 'comment avatar 40/15', res.commentAvatar);
  ok(res.commentHead.fs === '16px', 'comment name 16px', res.commentHead);
  ok(res.msgAvatar.w === 36, 'msg avatar 36 (base)', res.msgAvatar);
  ok(res.msgHead.fs === '15.5px', 'msg head 15.5px', res.msgHead);
  ok(res.searchAvatar.w === 46 && res.searchName.fs === '16px', 'search user 46/16', [res.searchAvatar, res.searchName]);
  ok(res.frowAvatar.w === 46 && res.frowAvatar.fs === '18px', 'frow avatar 46/18', res.frowAvatar);
  ok(res.baseAvatar.w === 36 && res.baseAvatar.fs === '16px', 'base avatar 36/16', res.baseAvatar);
  console.log(JSON.stringify({ pass, fail, errs: errs.slice(0, 3), res }));
  await browser.close(); site.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('ERR ' + (e && e.stack || e)); try { site.close(); } catch (x) {} process.exit(2); });
