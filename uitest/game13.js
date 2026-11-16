const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));

async function openGameViaUI(p) {
  await p.locator('#sideTab, .side-trigger, #menuBtn').first().click({ timeout: 5000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 600));
  const it = p.locator('[data-side="game"]');
  if (!(await it.isVisible().catch(() => false))) {
    await p.evaluate(() => { const d = document.querySelector('#sideDrawer'); if (d) d.classList.add('open'); const b = document.querySelector('#sideBackdrop'); if (b) b.classList.add('open'); });
    await new Promise(r => setTimeout(r, 500));
  }
  await it.click({ force: true });
  await new Promise(r => setTimeout(r, 1400));
}

(async () => {
  const b = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader']
  });
  const ctx = await b.newContext({ viewport: { width: 430, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + String(e).slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 160)); });

  const ok = [], fail = [];
  const step = async (n, f) => { try { await f(); ok.push(n); } catch (e) { fail.push(n + ' :: ' + String(e.message).split('\n')[0].slice(0, 110)); } };

  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await wait(2200);
  await p.locator('#guestBtn').click();
  await wait(1500);

  await step('打开游戏并开始', async () => {
    await openGameViaUI(p);
    await wait(1200);
    if (!(await p.locator('#gameSheet').evaluate(el => el.classList.contains('open')))) throw new Error('游戏面板没打开');
    await p.locator('#shStartBtn').click();
    await wait(3500);
    const st = await p.evaluate(() => window.__uShooter());
    if (!st.running) throw new Error('没进入运行状态');
    console.log('    isTouch=' + st.isTouch + ' sens=' + st.sens);
  });

  await step('鼠标移动即转视角', async () => {
    const y0 = (await p.evaluate(() => window.__uShooter())).yaw;
    await p.mouse.move(215, 500);
    for (let i = 1; i <= 10; i++) { await p.mouse.move(215 + i * 12, 500); await wait(16); }
    await wait(400);
    const y1 = (await p.evaluate(() => window.__uShooter())).yaw;
    console.log('    yaw ' + y0.toFixed(3) + ' -> ' + y1.toFixed(3));
    if (Math.abs(y1 - y0) < 0.05) throw new Error('鼠标移动没有改变视角');
  });

  await step('鼠标上下移动改俯仰', async () => {
    const b0 = (await p.evaluate(() => window.__uShooter())).pitch;
    for (let i = 1; i <= 8; i++) { await p.mouse.move(215, 500 - i * 10); await wait(16); }
    await wait(300);
    const b1 = (await p.evaluate(() => window.__uShooter())).pitch;
    if (Math.abs(b1 - b0) < 0.03) throw new Error('俯仰没变 ' + b0.toFixed(3));
  });

  await step('左键开火 / 右键开镜', async () => {
    await p.mouse.move(215, 480);
    await p.mouse.down({ button: 'left' });
    await wait(600);
    await p.mouse.up({ button: 'left' });
    await p.mouse.down({ button: 'right' });
    await wait(400);
    const ads = (await p.evaluate(() => window.__uShooter())).ads;
    await p.mouse.up({ button: 'right' });
    if (!ads) throw new Error('右键没开镜');
  });

  await step('设置里有「调整按键位置」', async () => {
    await p.locator('#shOptBtn').click();
    await wait(700);
    if (!(await p.locator('#shLayoutBtn').isVisible())) throw new Error('按钮不可见');
  });

  await step('进入布局模式', async () => {
    await p.locator('#shLayoutBtn').click();
    await wait(900);
    const st = await p.evaluate(() => window.__uShooter());
    if (!st.layout) throw new Error('没进入布局');
    if (!(await p.locator('#shLayoutBar').isVisible())) throw new Error('提示条没出现');
  });

  await step('拖动摇杆到新位置并保存', async () => {
    const before = (await p.evaluate(() => window.__uShooter())).btnPos.stick;
    const box = await p.locator('#shStick').boundingBox();
    const tx = 300, ty = 300;
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await p.mouse.down();
    await p.mouse.move(tx, ty, { steps: 12 });
    await p.mouse.up();
    await wait(500);
    const after = (await p.evaluate(() => window.__uShooter())).btnPos.stick;
    console.log('    stick ' + JSON.stringify(before) + ' -> ' + JSON.stringify(after));
    if (Math.abs(after.x - before.x) < 3 && Math.abs(after.y - before.y) < 3) throw new Error('位置没变');
    const left = await p.locator('#shStick').evaluate(el => el.style.left);
    if (!left) throw new Error('没写 left 样式');
  });

  await step('完成退出布局并持久化', async () => {
    await p.locator('#shLayoutDone').click();
    await wait(800);
    const st = await p.evaluate(() => window.__uShooter());
    if (st.layout) throw new Error('仍在布局模式');
    const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('u-shooter-cfg') || '{}').btnPos);
    if (!saved || !saved.stick) throw new Error('没有写入本地配置');
    console.log('    已保存 stick=' + JSON.stringify(saved.stick));
  });

  await step('刷新后位置仍生效', async () => {
    const before = (await p.evaluate(() => window.__uShooter())).btnPos.stick;
    await p.reload({ waitUntil: 'load' });
    await wait(2500);
    if (await p.locator('#guestBtn').isVisible().catch(() => false)) { await p.locator('#guestBtn').click(); }
    await wait(1800);
    await openGameViaUI(p);
    await wait(1500);
    const after = (await p.evaluate(() => window.__uShooter())).btnPos;
    if (!after || !after.stick) throw new Error('刷新后丢配置');
    if (Math.abs(after.stick.x - before.x) > 1.5) throw new Error('位置不一致');
  });

  await step('恢复默认位置', async () => {
    if (!(await p.locator('#gameSheet').evaluate(el => el.classList.contains('open')).catch(() => false))) {
      await openGameViaUI(p);
    }
    await p.locator('#shStartBtn').click().catch(() => {});
    await wait(1500);
    await p.locator('#shOptBtn').click();
    await wait(700);
    await p.locator('#shLayoutReset').click();
    await wait(600);
    const st = await p.evaluate(() => window.__uShooter());
    const left = await p.locator('#shStick').evaluate(el => el.style.left);
    if (st.btnPos) throw new Error('btnPos 未清空');
    if (left) throw new Error('样式未还原：' + left);
  });

  console.log('PASS ' + ok.length + '/' + (ok.length + fail.length));
  fail.forEach(f => console.log('FAIL ' + f));
  console.log('errors ' + errs.length);
  errs.slice(0, 6).forEach(e => console.log('  ' + e));
  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\game13.png' });
  await b.close();
})();
