const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await b.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + String(e).slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 200)); });
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await wait(2200);
  await p.locator('#guestBtn').click();
  await wait(1600);

  const ok = [], fail = [];
  const step = async (n, fn) => { try { await fn(); ok.push(n); } catch (e) { fail.push(n + ' :: ' + e.message.split('\n')[0].slice(0, 110)); } };

  await step('打开游戏', async () => {
    await p.evaluate(() => { document.querySelector('#sideDrawer').classList.add('open'); });
    await wait(400);
    const hit = await p.evaluate(() => {
      const btns = [...document.querySelectorAll('#sideDrawer [data-side],#sideDrawer button')];
      const g = btns.find(b => /游戏|火线/.test(b.textContent || ''));
      if (!g) return 'no-btn:' + btns.map(b => b.textContent.trim()).join('|');
      g.click(); return 'clicked:' + g.textContent.trim();
    });
    console.log('  drawer ->', hit);
    await wait(4500);
    const open = await p.evaluate(() => document.querySelector('#gameSheet').classList.contains('open'));
    if (!open) throw new Error('gameSheet 未打开');
  });

  await step('大厅三行都在', async () => {
    const r = await p.evaluate(() => ({
      map: document.querySelectorAll('#shMapOpts button').length,
      gun: document.querySelectorAll('#shGunOpts button').length,
      skin: document.querySelectorAll('#shSkinOpts button').length,
      note: (document.querySelector('#shLobbyNote') || {}).textContent || ''
    }));
    console.log('  lobby', JSON.stringify(r).slice(0, 200));
    if (!r.map || !r.gun || !r.skin) throw new Error('选项缺失');
  });

  await step('换地图（沙漠）重建场景', async () => {
    await p.evaluate(() => document.querySelector('#shMapOpts button[data-map="desert"]').click());
    await wait(1500);
    const on = await p.evaluate(() => document.querySelector('#shMapOpts button[data-map="desert"]').classList.contains('on'));
    if (!on) throw new Error('选中态没变');
  });

  await step('换枪（狙击）', async () => {
    await p.evaluate(() => document.querySelector('#shGunOpts button[data-gun="sniper"]').click());
    await wait(1200);
    const on = await p.evaluate(() => document.querySelector('#shGunOpts button[data-gun="sniper"]').classList.contains('on'));
    if (!on) throw new Error('枪没切过去');
  });

  await step('换皮肤（丛林）', async () => {
    await p.evaluate(() => document.querySelector('#shSkinOpts button[data-skin="forest"]').click());
    await wait(900);
  });

  await step('FOV 滑块生效', async () => {
    await p.evaluate(() => { const i = document.querySelector('#shFov'); i.value = 88; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await wait(400);
    const v = await p.evaluate(() => ({ label: document.querySelector('#shFovV').textContent, fov: (window.__uShooter ? 0 : 0) }));
    console.log('  fov label', JSON.stringify(v));
    if (v.label !== '88') throw new Error('FOV 数值没更新: ' + v.label);
  });

  await step('开始行动', async () => {
    await p.locator('#shStartBtn').click();
    await wait(2500);
    const s = await p.evaluate(() => (window.__uShooter ? window.__uShooter() : null));
    console.log('  state', JSON.stringify(s));
    if (!s || !s.running) throw new Error('没进战斗');
  });

  await step('子弹数按枪变（狙击 5）', async () => {
    const ammo = await p.evaluate(() => document.querySelector('#shAmmo').textContent);
    console.log('  ammo', ammo);
    if (ammo !== '5') throw new Error('弹匣仍是 ' + ammo);
  });

  await step('开火扣子弹', async () => {
    await p.evaluate(() => { const f = document.querySelector('#shFire'); f.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
    await wait(900);
    await p.evaluate(() => { const f = document.querySelector('#shFire'); f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); });
    await wait(300);
    const ammo = await p.evaluate(() => document.querySelector('#shAmmo').textContent);
    console.log('  ammo after fire', ammo);
    if (Number(ammo) >= 5) throw new Error('没扣弹');
  });

  await p.screenshot({ path: 'D:\\deepseek\\gouzuoqu\\U\\.tmp-test\\shots\\game15.png' });
  console.log('PASS ' + ok.length + '/' + (ok.length + fail.length));
  fail.forEach(f => console.log('FAIL ' + f));
  console.log('errors ' + errs.length);
  errs.slice(0, 5).forEach(e => console.log('  ' + e));
  await b.close();
})();
