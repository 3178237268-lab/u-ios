const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  });
  const ctx = await b.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + String(e).slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 160)); });

  const ok = [], fail = [];
  const step = async (name, fn) => {
    try { await fn(); ok.push(name); } catch (e) { fail.push(name + ' :: ' + String(e.message).split('\n')[0].slice(0, 110)); }
  };

  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await wait(2200);
  await step('游客登录', async () => { await p.locator('#guestBtn').click(); await wait(1400); });
  await step('打开侧栏', async () => {
    const drawers = ['#sideDrawer', '#drawer'];
    const vis = await p.locator('.side-item[data-side="game"]:visible').count();
    if (!vis) {
      // 从左侧右滑打开抽屉
      await p.mouse.move(8, 420); await p.mouse.down();
      await p.mouse.move(320, 420, { steps: 12 }); await p.mouse.up();
      await wait(600);
    }
  });
  await step('进入游戏', async () => {
    await p.locator('.side-item[data-side="game"]:visible').first().click();
    await wait(1200);
  });
  await step('场景载入', async () => {
    await p.locator('#shStartBtn').click();
    await wait(4500);
    const built = await p.locator('#shCanvas').isVisible();
    if (!built) throw new Error('canvas 不可见');
  });
  await step('打开设置面板', async () => {
    await p.locator('#shOptBtn').click();
    await wait(500);
    if (!(await p.locator('#shOpts').getAttribute('class') || '').includes('open')) throw new Error('面板未展开');
  });
  await step('设置面板自动暂停', async () => {
    const paused = await p.evaluate(() => document.getElementById('shStage').classList.contains('paused'));
    if (!paused) throw new Error('未暂停');
  });
  await step('切画质=流畅', async () => {
    await p.locator('#shQuality button[data-q="low"]').click();
    await wait(700);
    const on = await p.evaluate(() => document.querySelector('#shQuality button[data-q="low"]').classList.contains('on'));
    if (!on) throw new Error('按钮未高亮');
  });
  await step('画质生效(阴影关闭)', async () => {
    const st = await p.evaluate(() => {
      const c = document.getElementById('shCanvas');
      return { w: c.width, h: c.height, cssW: c.clientWidth };
    });
    if (!st.w) throw new Error('canvas 尺寸丢失');
  });
  await step('切画质=高清', async () => {
    await p.locator('#shQuality button[data-q="high"]').click();
    await wait(600);
  });
  await step('开镜模式=切换', async () => {
    await p.locator('#shAdsMode button[data-ads="toggle"]').click();
    await wait(300);
  });
  await step('灵敏度滑到 1.8', async () => {
    await p.locator('#shSens').fill('1.8');
    await wait(200);
    const v = await p.locator('#shSensV').innerText();
    if (v.trim() !== '1.80') throw new Error('显示=' + v);
  });
  await step('改键：前进改 KeyI', async () => {
    await p.locator('#shKeys button[data-bind="fwd"]').click();
    await wait(200);
    await p.keyboard.press('KeyI');
    await wait(300);
    const label = await p.locator('#shKeys button[data-bind="fwd"] [data-code]').innerText();
    if (label.trim() !== 'I') throw new Error('显示=' + label);
  });
  await step('键位已持久化', async () => {
    const raw = await p.evaluate(() => localStorage.getItem('u-shooter-cfg'));
    if (!raw || JSON.parse(raw).binds.fwd !== 'KeyI') throw new Error('未写入 ' + raw);
  });
  await step('恢复默认键位', async () => {
    await p.locator('#shKeysReset').click();
    await wait(300);
    const label = await p.locator('#shKeys button[data-bind="fwd"] [data-code]').innerText();
    if (label.trim() !== 'W') throw new Error('显示=' + label);
  });
  await step('悬浮菜单=移除', async () => {
    await p.locator('#shFloatMode button[data-float="hide"]').click();
    await wait(300);
    const cls = await p.locator('#shFloat').getAttribute('class');
    if (!cls.includes('removed')) throw new Error('class=' + cls);
  });
  await step('关设置恢复战斗', async () => {
    await p.locator('#shOptsClose').click();
    await wait(400);
    const paused = await p.evaluate(() => document.getElementById('shStage').classList.contains('paused'));
    if (paused) throw new Error('仍在暂停');
  });
  await step('暂停按钮', async () => {
    await p.locator('#shPauseBtn').click();
    await wait(400);
    const paused = await p.evaluate(() => document.getElementById('shStage').classList.contains('paused'));
    if (!paused) throw new Error('没暂停');
  });
  await step('继续按钮', async () => {
    await p.locator('#shResume').click();
    await wait(400);
    const paused = await p.evaluate(() => document.getElementById('shStage').classList.contains('paused'));
    if (paused) throw new Error('仍暂停');
  });
  await step('双击恢复悬浮菜单', async () => {
    await p.locator('#shCanvas').dblclick({ position: { x: 200, y: 300 } });
    await wait(400);
    const cls = await p.locator('#shFloat').getAttribute('class');
    if (cls.includes('removed')) throw new Error('class=' + cls);
  });
  await step('触屏开镜按钮', async () => {
    await p.locator('#shAds').click();
    await wait(350);
    const ads = await p.evaluate(() => document.getElementById('shStage').classList.contains('ads'));
    if (!ads) throw new Error('未开镜');
  });
  await step('再点收起开镜', async () => {
    await p.locator('#shAds').click();
    await wait(350);
  });
  await step('退出游戏', async () => {
    await p.locator('#gameClose').click();
    await wait(800);
  });

  console.log('PASS ' + ok.length + '/' + (ok.length + fail.length));
  fail.forEach(f => console.log('FAIL ' + f));
  console.log('errors ' + errs.length);
  errs.slice(0, 8).forEach(e => console.log('  ' + e));
  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\gamecfg.png' });
  await b.close();
})();
