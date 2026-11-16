const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const p = await (await b.newContext({ viewport: { width: 430, height: 900 } })).newPage();
  const bad = [];
  p.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url().slice(0, 100)); });
  await p.addInitScript(() => localStorage.setItem('u-server', 'http://127.0.0.1:8787'));
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await wait(1500);
  await p.locator('#authUser').fill('bugb75145');
  await p.locator('#authPass').fill('pass1234');
  await p.locator('#authPass').press('Enter');
  await wait(3500);

  // 切到「说说」
  const tabs = await p.locator('.seg, .ntab, .tab, .feedtab').evaluateAll(ns => ns.map(n => (n.textContent || '').trim() + '|' + (n.getAttribute('data-seg') || n.getAttribute('data-tab') || '')));
  console.log('切换控件 =', JSON.stringify(tabs).slice(0, 300));
  const say = p.locator('text=说说').first();
  if (await say.count()) { await say.click().catch(e => console.log('点说说失败', e.message.slice(0, 60))); await wait(1500); }
  async function snap(tag) {
    const t = await p.locator('.post:visible .ptext').allInnerTexts();
    const imgs = await p.locator('.post:visible img').evaluateAll(ns => ns.map(n => ({ src: (n.currentSrc || n.src || '').slice(-30), w: n.naturalWidth })));
    console.log(tag, '帖子=', JSON.stringify(t), '图片=', JSON.stringify(imgs));
  }
  await snap('切到说说后');
  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\feed-b-talk.png' });

  // 切回首页
  const home = p.locator('text=为你推荐').first();
  if (await home.count()) { await home.click().catch(() => {}); await wait(1200); }
  await snap('为你推荐');
  console.log('HTTP>=400 =', JSON.stringify(bad.slice(0, 6)));
  await b.close();
})();
