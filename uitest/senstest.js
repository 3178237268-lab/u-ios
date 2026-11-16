const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
const BASE = 'http://127.0.0.1:8787';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII=', 'base64');

const login = async (p, user, pass) => {
  await p.locator('#authUser').fill(user);
  await p.locator('#authPass').fill(pass);
  await p.locator('#authPass').press('Enter');
  await wait(4000);
};

(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await b.newContext({ viewport: { width: 430, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + String(e).slice(0, 140)));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 140)); });
  await p.addInitScript(() => { localStorage.setItem('u-server', 'http://127.0.0.1:8787'); localStorage.removeItem('u-server-off'); });
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await wait(1600);

  const stamp = Date.now();
  const uA = 'sensA' + (stamp % 100000);
  const uB = 'sensB' + (stamp % 100000);
  const postText = '18+ 测试 ' + stamp;

  // A：注册、发一条带图 + 勾 18+ 的帖
  await p.locator('[data-auth-tab="register"]').click();
  await wait(400);
  await login(p, uA, 'pass1234');
  await p.locator('#composeBtn').click();
  await wait(800);
  await p.locator('#composeText').fill(postText);
  await p.locator('#sensRow').click();
  const sensChecked = await p.locator('#composeSensitive').isChecked();
  const privChecked = await p.locator('#composePrivate').isChecked();
  console.log('发布前：18+ 勾选 =', sensChecked, ' 仅自己可见勾选 =', privChecked);
  await p.locator('#filePicker').setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: PNG });
  await wait(2500);
  await p.locator('#composePublish').click();
  await wait(4500);

  const check = await fetch(BASE + '/api/posts?limit=5').then(r => r.json());
  const mine = (check.posts || []).find(x => (x.text || '') === postText);
  console.log('服务端记录 =', JSON.stringify(mine && { id: mine.id, private: mine.private, sensitive: mine.sensitive, media: (mine.media || []).length }));

  // B：换账号看
  await p.evaluate(() => { try { localStorage.removeItem('u-server-token'); localStorage.removeItem('u-server-user'); localStorage.removeItem('u-session'); } catch (e) {} });
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await wait(1800);
  await p.locator('[data-auth-tab="register"]').click();
  await wait(400);
  await login(p, uB, 'pass1234');
  await wait(2500);

  let seen = false, veil = false, imgHidden = true;
  for (let i = 0; i < 6 && !seen; i++) {
    seen = await p.locator('.post:visible .ptext', { hasText: postText }).count() > 0;
    if (!seen) { await p.reload({ waitUntil: 'load' }); await wait(3000); }
  }
  if (seen) {
    const card = p.locator('.post:visible', { hasText: postText }).first();
    veil = await card.locator('.pveil').count() > 0;
    const veilTxt = veil ? await card.locator('.pveil').first().innerText() : '';
    const badge = veilTxt.replace(/\s+/g, ' ').slice(0, 40);
    imgHidden = await card.locator('.pmedia.private').count() > 0;
    const vis = await card.locator('.pveil-btn').first().innerText().catch(() => '');
    console.log('B 看到的：遮罩 =', veil, ' 遮罩文案 =', badge, ' 按钮 =', vis, ' 媒体被 .private 包住 =', imgHidden);
  }
  console.log('B 能看到这条 18+ 帖 =', seen);
  const bFeed = await p.locator('.post:visible .ptext').allInnerTexts();
  console.log('B 首页帖子 =', JSON.stringify(bFeed.slice(0, 6)));
  console.log('errors', errs.length); errs.slice(0, 5).forEach(e => console.log('  ' + e));
  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\sens-b.png' });
  await b.close();
})();

