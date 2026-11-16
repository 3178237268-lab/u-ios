const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await b.newContext();

  // A 普通模式
  const p1 = await ctx.newPage();
  const e1 = [];
  p1.on('pageerror', e => e1.push(String(e).slice(0, 120)));
  p1.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) e1.push(m.text().slice(0, 120)); });
  await p1.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await wait(2200);
  const a = await p1.evaluate(() => ({ splash: !!document.getElementById('splash'), booting: document.body.classList.contains('booting'), guest: document.getElementById('guestBtn') ? document.getElementById('guestBtn').offsetParent !== null : false, posts: document.querySelectorAll('.post').length }));
  console.log('A 普通     ', JSON.stringify(a), 'errors', e1.length);
  await p1.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\m-normal.png' });

  // B 交互预览（blob + allow-scripts）
  const p2 = await ctx.newPage();
  const e2 = [];
  p2.on('pageerror', e => e2.push(String(e).slice(0, 120)));
  await p2.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await p2.evaluate(async () => {
    const txt = await (await fetch('/index.html')).text();
    const url = URL.createObjectURL(new Blob([txt], { type: 'text/html' }));
    const f = document.createElement('iframe');
    f.setAttribute('sandbox', 'allow-scripts');
    f.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:9';
    f.src = url; document.body.appendChild(f);
  });
  await wait(3500);
  const fb = p2.frames().find(f => f.url().startsWith('blob:'));
  const bst = await fb.evaluate(() => ({ splash: !!document.getElementById('splash'), booting: document.body.classList.contains('booting'), guest: !!document.getElementById('guestBtn') && document.getElementById('guestBtn').offsetParent !== null, posts: document.querySelectorAll('.post').length }));
  console.log('B 交互预览 ', JSON.stringify(bst), 'errors', e2.length);
  await p2.screenshot({ path: 'D:\\deepseek\resources\\..\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\m-sandbox.png' }).catch(async () => { await p2.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\m-sandbox.png' }); });

  // C 纯静态预览（sandbox="" 禁脚本）
  const p3 = await ctx.newPage();
  await p3.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await p3.evaluate(() => {
    const f = document.createElement('iframe');
    f.setAttribute('sandbox', '');
    f.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:9';
    f.src = '/index.html';
    document.body.appendChild(f);
  });
  await wait(3000);
  const fc = p3.frames().find(f => f.url().includes('index.html'));
  const cst = await fc.evaluate(() => {
    const s = document.getElementById('splash');
    const ns = document.querySelector('noscript');
    return {
      splashOpacity: s ? getComputedStyle(s).opacity : null,
      noscriptVisible: ns ? (ns.offsetParent !== null || ns.getBoundingClientRect().height > 0) : false,
      noscriptText: ns ? ns.innerText.slice(0, 40).replace(/\n/g, ' ') : null,
      booting: document.body.classList.contains('booting'),
      appDisplay: document.getElementById('app') ? getComputedStyle(document.getElementById('app')).display : null
    };
  });
  console.log('C 禁脚本预览', JSON.stringify(cst));
  await p3.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\m-static.png' });
  await b.close();
})();
