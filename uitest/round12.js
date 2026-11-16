const { chromium } = require('playwright-core');
const fs = require('fs');
const wait = ms => new Promise(r => setTimeout(r, ms));
const BASE = 'http://127.0.0.1:8787';

(async () => {
  const u = 'uiuser' + Date.now().toString().slice(-6);
  const pass = 'pass1234';
  let r = await fetch(BASE + '/api/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: pass, nickname: u })
  });
  const reg = await r.json();
  const tok = reg.token;
  await fetch(BASE + '/api/posts', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
    body: JSON.stringify({ text: '普通用户帖 ' + u, private: false, sensitive: false })
  });

  const b = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true,
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader']
  });
  const ctx = await b.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + String(e).slice(0, 160)));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 140)); });

  const ok = [], fail = [];
  const step = async (n, f) => { try { await f(); ok.push(n); } catch (e) { fail.push(n + ' :: ' + String(e.message).split('\n')[0].slice(0, 100)); } };

  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await wait(2200);

  await step('账号登录', async () => {
    await p.locator('#authUser').fill(u);
    await p.locator('#authPass').fill(pass);
    await p.locator('#authSubmit').click();
    await wait(2200);
    if (await p.locator('#guestBtn:visible').count()) throw new Error('仍在登录页');
  });

  await step('首页(为你推荐)只有官方帖', async () => {
    const texts = await p.locator('.post .ptext:visible').allInnerTexts();
    const mine = texts.filter(t => t.includes('普通用户帖'));
    if (mine.length) throw new Error('普通帖混进推荐流：' + mine[0].slice(0, 20));
    const hasOfficial = texts.some(t => t.trim().length > 0);
    if (!hasOfficial) throw new Error('首页一条都没有');
  });

  await step('切到说说能看到普通帖', async () => {
    await p.locator('.feedtab[data-home="talk"]').click();
    await wait(1200);
    const texts = await p.locator('.post .ptext:visible').allInnerTexts();
    if (!texts.some(t => t.includes('普通用户帖'))) throw new Error('说说里没有：' + texts.slice(0, 3).join('|'));
  });

  await step('发帖：图片上传并立即显示', async () => {
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000154a24f5f0000000049454e44ae426082', 'hex');
    fs.writeFileSync('D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\tiny.png', png);
    await p.locator('#composeBtn').click();
    await wait(700);
    await p.locator('#composeText').fill('图帖 ' + Date.now());
    const picker = p.locator('#filePicker');
    await picker.setInputFiles('D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\tiny.png');
    await wait(2500);
    await p.locator('#composePublish').click();
    await wait(3000);
    const body = await p.locator('.post:visible').first().innerHTML();
    if (/媒体同步中/.test(body)) throw new Error('还在显示"媒体同步中"');
  });

  await step('新帖带真实图片', async () => {
    const img = await p.locator('.post:visible img').first().getAttribute('src');
    if (!img || !/^(blob:|https?:.*\/media\/|\/media\/)/.test(img)) throw new Error('src=' + img);
  });

  await step('打开详情显示浏览量', async () => {
    const before = await p.locator('.post:visible [data-act="views"] span').first().innerText().catch(() => '0');
    await p.locator('.post:visible .ptext').first().click();
    await wait(1600);
    if (!(await p.locator('#postSheet').isVisible())) throw new Error('详情没打开');
    const rows = p.locator('#postBody .detail-stat b');
    const n = await rows.count();
    if (n < 3) throw new Error('详情统计只有 ' + n + ' 项');
    const views = await rows.nth(2).innerText();
    if (!/\d/.test(views)) throw new Error('查看数异常 ' + views);
    console.log('    详情查看 ' + views + '（列表原 ' + before + '）');
  });

  await step('返回列表', async () => {
    await p.locator('#postBack').click();
    await wait(900);
  });

  await step('搜索页可见', async () => {
    await p.locator('.tab[data-tab="search"]').click();
    await wait(900);
    if (!(await p.locator('#viewSearch').isVisible())) throw new Error('搜索页没显示');
  });

  console.log('PASS ' + ok.length + '/' + (ok.length + fail.length));
  fail.forEach(f => console.log('FAIL ' + f));
  console.log('errors ' + errs.length);
  errs.slice(0, 5).forEach(e => console.log('  ' + e));
  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\round12.png' });
  await b.close();
})();
