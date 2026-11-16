
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'n40-data');
fs.rmSync(DATA, { recursive: true, force: true });
fs.mkdirSync(DATA, { recursive: true });
const PORT = 18933, SITE = 18833;
const S = 'http://127.0.0.1:' + PORT, PAGE = 'http://127.0.0.1:' + SITE + '/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18733', U_DATA_DIR: DATA }, stdio: 'ignore' });
const site = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const file = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(ROOT, p);
  fs.readFile(file, (e, buf) => {
    if (e) { res.writeHead(404); res.end('no'); return; }
    res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
    res.end(buf);
  });
}).listen(SITE);
let pass = 0, fail = 0;
function ok(c, n, x) { if (c) { pass++; } else { fail++; console.log('FAIL ' + n + ' :: ' + JSON.stringify(x)); } }

(async () => {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.goto(PAGE, { waitUntil: 'load', timeout: 40000 });
  await page.evaluate((s) => { localStorage.setItem('u-server', s); localStorage.setItem('u-theme', 'dark'); }, S);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.click('#guestBtn').catch(() => {});
  await page.waitForTimeout(1800);

  const sizes = await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'probe40';
    host.style.cssText = 'position:fixed;left:0;top:0;width:420px;z-index:99999;background:#111';
    host.innerHTML = [
      '<div class="post"><div class="phead"><span class="avatar">一</span><span class="pname">一碗汤在路上</span></div>',
      '<div class="ptext">正文文案示例文字</div></div>',
      '<div class="comment"><div class="comment-main"><div class="phead"><span class="pname">评论者名字</span></div><div class="ptext">评论文案示例</div></div></div>',
      '<div class="msg-row"><div class="avatar">一</div><div class="msg-main"><div class="msg-head">一碗汤在路上 <span>@bot_04</span></div><div class="msg-sub">预览文案示例</div></div></div>',
      '<div class="frow"><div class="avatar">一</div><div class="fmain"><div class="fname">关注行名字</div><div class="fhandle">@handle</div></div></div>',
      '<div class="search-user"><div class="avatar">一</div><div class="search-user-main"><b>搜索结果名字</b><span>@handle</span></div></div>',
      '<div class="notify-item"><div class="notify-ico"></div><div class="notify-main"><h4>通知标题名字</h4><p>通知正文文案</p></div></div>',
      '<div class="block-row"><div class="avatar">一</div><div class="block-name">屏蔽名单名字</div></div>',
      '<div class="lan-dev"><div class="avatar">一</div><div class="lan-dev-name">局域网设备名</div></div>',
      '<div class="dm-peer-name">会话标题<em>@handle</em></div>'
    ].join('');
    document.body.appendChild(host);
    const fs2 = (sel) => { const el = host.querySelector(sel); return el ? parseFloat(getComputedStyle(el).fontSize) : -1; };
    return {
      postName: fs2('.post .pname'), postText: fs2('.post .ptext'),
      cmtName: fs2('.comment .pname'), cmtText: fs2('.comment .ptext'),
      msgName: fs2('.msg-head'), msgHandle: fs2('.msg-head span'), msgSub: fs2('.msg-sub'),
      frowName: fs2('.fname'), frowHandle: fs2('.fhandle'),
      searchName: fs2('.search-user-main b'), searchHandle: fs2('.search-user-main span'),
      notifyName: fs2('.notify-item h4'), notifyText: fs2('.notify-item p'),
      blockName: fs2('.block-name'), lanName: fs2('.lan-dev-name'),
      peerName: fs2('.dm-peer-name'), peerHandle: fs2('.dm-peer-name em'),
      sideName: fs2('.side-name'), pnameBig: fs2('.pname-big')
    };
  });
  ok(sizes.postName > sizes.postText + 1, 'post name bigger than body text', [sizes.postName, sizes.postText]);
  ok(sizes.cmtName > sizes.cmtText + 1, 'comment name bigger than comment text', [sizes.cmtName, sizes.cmtText]);
  ok(sizes.msgName >= 17 && sizes.msgName > sizes.msgSub + 1, 'dm list name >=17 and bigger than preview', [sizes.msgName, sizes.msgSub]);
  ok(sizes.msgHandle < sizes.msgName, 'dm handle smaller than name', [sizes.msgHandle, sizes.msgName]);
  ok(sizes.frowName > sizes.frowHandle + 2, 'follow-row name bigger than handle', [sizes.frowName, sizes.frowHandle]);
  ok(sizes.searchName > sizes.searchHandle + 2, 'search name bigger than handle', [sizes.searchName, sizes.searchHandle]);
  ok(sizes.notifyName > sizes.notifyText + 1, 'notify title bigger than body', [sizes.notifyName, sizes.notifyText]);
  ok(sizes.blockName >= 17 && sizes.lanName >= 17, 'block/lan names >=17', [sizes.blockName, sizes.lanName]);
  ok(sizes.peerName > sizes.peerHandle + 2, 'dm peer name bigger than handle', [sizes.peerName, sizes.peerHandle]);
  ok(sizes.sideName >= 23 && sizes.pnameBig >= 23, 'drawer/profile names >=23', [sizes.sideName, sizes.pnameBig]);
  ok(sizes.postName === 17.5 && sizes.cmtName === 17, 'exact: post 17.5 / comment 17', [sizes.postName, sizes.cmtName]);
  const overflow = await page.evaluate(() => { const p = document.querySelector('#probe40 .post .pname'); const b = p.getBoundingClientRect(); return { w: Math.round(b.width), max: getComputedStyle(p).maxWidth }; });
  ok(overflow.w <= 200, 'name does not blow the row', overflow);
  ok(errs.length === 0, 'no pageerror', errs.slice(0, 3));
  await page.screenshot({ path: path.join(ROOT, 'uitest', 'name40.png'), clip: { x: 0, y: 0, width: 420, height: 700 } }).catch(() => {});
  console.log('SIZES ' + JSON.stringify(sizes));
  console.log('RESULT ' + pass + '/' + (pass + fail));
  await browser.close();
  srv.kill();
  site.close();
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) {}
  process.exit(0);
})().catch((e) => { console.log('ERR ' + (e && e.stack || e)); try { srv.kill(); } catch (_) {} process.exit(1); });