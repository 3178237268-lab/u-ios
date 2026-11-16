const { spawn } = require('node:child_process');
const path = require('node:path');
const http = require('node:http');
const fs = require('node:fs');
const { chromium } = require('playwright-core');

const ROOT = 'D:\\deepseek\\gouzuoqu\\U';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function staticServer(port) {
  return new Promise((res) => {
    const srv = http.createServer((q, r) => {
      const p = q.url.split('?')[0];
      const file = path.join(ROOT, p === '/' ? 'index.html' : p.replace(/^\//, ''));
      fs.readFile(file, (e, d) => {
        if (e) { r.writeHead(404); r.end('nf'); return; }
        const ext = path.extname(file);
        const mime = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.js' ? 'text/javascript' : 'application/octet-stream';
        r.writeHead(200, { 'Content-Type': mime });
        r.end(d);
      });
    });
    srv.listen(port, () => res(srv));
  });
}

(async () => {
  const results = [];
  const ok = (n, cond, val) => results.push({ n, pass: !!cond, val });
  const srv = await staticServer(18771);
  const b = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const pg = await b.newPage({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
  const errs = [];
  pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.goto('http://127.0.0.1:18771/index.html', { waitUntil: 'load' });
  await pg.waitForTimeout(800);
  const r = await pg.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'probe';
    host.innerHTML = `
      <article class="post"><div class="phead"><span class="pname">名</span></div>
        <div class="ptext">第一行文字
第二行文字</div>
        <div class="pmeta"><span>a</span><span>b</span></div>
        <div class="pactions"><button><span>1</span></button></div></article>
      <div class="notify-item"><div><h4>标题</h4><p>通知正文第一行
第二行</p><div class="nt">刚刚</div></div></div>
      <div class="dm-bubble them">私信第一行
第二行</div>
      <div class="hot-item"><div><div>热搜标题</div><div>@某人 浏览 1</div></div></div>
      <div class="search-box"><input></div>
      <div class="search-user"><div class="search-user-main"><b>名字</b><span>@handle</span></div></div>
      <div class="frow"><div>行</div></div>
      <div class="msg-row"><div>会话</div></div>
      <div class="comment"><div class="comment-main"><div class="phead">名</div><div class="ptext">评论</div></div></div>`;
    document.body.appendChild(host);
    const cs = (sel) => getComputedStyle(document.querySelector('#probe ' + sel));
    const num = (v) => parseFloat(v);
    const post = cs('.post');
    const ptext = cs('.ptext');
    return {
      postRadius: num(post.borderTopLeftRadius),
      postPad: num(post.paddingTop),
      ptextLH: num(ptext.lineHeight),
      ptextFS: num(ptext.fontSize),
      ptextMT: num(ptext.marginTop),
      pactionsMT: num(cs('.pactions').marginTop),
      pmetaMT: num(cs('.pmeta').marginTop),
      notifyRadius: num(cs('.notify-item').borderTopLeftRadius),
      notifyLH: num(cs('.notify-item p').lineHeight),
      dmRadius: num(cs('.dm-bubble').borderTopLeftRadius),
      dmLH: num(cs('.dm-bubble').lineHeight),
      hotRadius: num(cs('.hot-item').borderTopLeftRadius),
      searchBoxRadius: num(cs('.search-box').borderTopLeftRadius),
      searchUserRadius: num(cs('.search-user').borderTopLeftRadius),
      frowRadius: num(cs('.frow').borderTopLeftRadius),
      msgRadius: num(cs('.msg-row').borderTopLeftRadius),
      commentRadius: num(cs('.comment').borderTopLeftRadius),
      commentPtextLH: num(cs('.comment .ptext').lineHeight),
    };
  });
  ok('post 圆角 34', r.postRadius === 34, r.postRadius);
  ok('ptext 行距 ≈27.6', Math.abs(r.ptextLH - r.ptextFS * 1.78) < 0.6, r.ptextLH.toFixed(1));
  ok('ptext 上间距 9', r.ptextMT === 9, r.ptextMT);
  ok('pactions 上间距 16', r.pactionsMT === 16, r.pactionsMT);
  ok('pmeta 上间距 12', r.pmetaMT === 12, r.pmetaMT);
  ok('通知行距 >19', r.notifyLH > 19, r.notifyLH.toFixed(1));
  ok('通知圆角 26', r.notifyRadius === 26, r.notifyRadius);
  ok('私信气泡圆角 24', r.dmRadius === 24, r.dmRadius);
  ok('私信气泡行距 >19', r.dmLH > 19, r.dmLH.toFixed(1));
  ok('热搜行圆角 24', r.hotRadius === 24, r.hotRadius);
  ok('搜索框圆角 30', r.searchBoxRadius === 30, r.searchBoxRadius);
  ok('搜索用户行圆角 26', r.searchUserRadius === 26, r.searchUserRadius);
  ok('关注行圆角 24', r.frowRadius === 24, r.frowRadius);
  ok('私信会话行圆角 30', r.msgRadius === 30, r.msgRadius);
  ok('评论圆角 24', r.commentRadius === 24, r.commentRadius);
  ok('评论行距 >19', r.commentPtextLH > 19, r.commentPtextLH.toFixed(1));
  ok('无 JS 报错', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log(JSON.stringify({ pass: results.filter((x) => x.pass).length, total: results.length, fails: results.filter((x) => !x.pass) }));
  await b.close();
  srv.close();
  process.exit(0);
})();
