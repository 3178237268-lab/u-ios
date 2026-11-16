const { chromium } = require('playwright');
const fs = require('fs');
const errs = [];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: '/workspace/uitest/01_auth.png' });
  await p.click('#guestBtn');
  await p.waitForTimeout(1300);
  await p.screenshot({ path: '/workspace/uitest/02_feed.png' });

  // compose
  await p.click('.tab-mid .fab, #composeBtn');
  await p.waitForTimeout(500);
  await p.screenshot({ path: '/workspace/uitest/03_compose.png' });
  await p.click('#composeClose');
  await p.waitForTimeout(400);

  // settings
  await p.click('.tab[data-tab="profile"]');
  await p.waitForTimeout(500);
  await p.screenshot({ path: '/workspace/uitest/04_profile.png' });
  await p.click('#settingsBtn');
  await p.waitForTimeout(500);
  await p.screenshot({ path: '/workspace/uitest/05_settings.png' });
  await p.click('#cacheRow');
  await p.waitForTimeout(400);
  const toast = await p.textContent('#toast');
  console.log('cache toast:', toast);
  await p.click('#settingsClose');
  await p.waitForTimeout(400);

  // feed post detail
  await p.click('.tab[data-tab="talk"]');
  await p.waitForTimeout(600);
  const first = p.locator('#talkList .post').first();
  if (await first.count()) {
    await first.locator('.ptext').click();
    await p.waitForTimeout(600);
    await p.screenshot({ path: '/workspace/uitest/06_detail.png' });
    await p.click('#postBack');
    await p.waitForTimeout(400);
  }

  // compose with media to test privacy + video
  await p.click('#composeBtn');
  await p.waitForTimeout(400);
  await p.fill('#composeText', 'UI 皮肤测试');
  await p.setInputFiles('#filePicker', ['/workspace/uitest/sample.png', '/workspace/uitest/sample.webm']);
  await p.waitForTimeout(2600);
  await p.click('#privRow');
  await p.click('#composePublish');
  await p.waitForTimeout(1800);
  await p.screenshot({ path: '/workspace/uitest/07_private_post.png' });

  console.log('page errors:', errs);
  await b.close();
  fs.writeFileSync('/workspace/uitest/errors.json', JSON.stringify(errs));
})();
