
const { chromium } = require('playwright-core');
(async () => {
  const out = { errs: [], console: [] };
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox','--disable-gpu'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 1 });
    page.on('pageerror', e => out.errs.push(String(e).slice(0,150)));
    page.on('console', m => { if (m.type()==='error') out.console.push(m.text().slice(0,150)); });
    await page.goto('http://127.0.0.1:8787/admin', { waitUntil: 'load' });
    await page.waitForTimeout(700);
    await page.fill('#lgUser', 'admin123');
    await page.fill('#lgPass', 'admin123');
    await page.click('#loginForm button[type=submit]');
    await page.waitForTimeout(2500);
    out.kv = await page.evaluate(() => document.getElementById('backupKv').innerText.replace(/\n/g,' | '));
    out.rows = await page.evaluate(() => Array.from(document.querySelectorAll('#backupList tr')).map(tr => tr.innerText.replace(/\n/g,' / ').slice(0,150)));
    out.hint = await page.evaluate(() => (document.querySelector('.data-hint') || {}).textContent);
    const panel = await page.$('#view-overview .panel:last-child');
    if (panel) await panel.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/bk56-panel.png' });
    /* 备份列表再点一次「立即备份」，确认目录数增加 */
    await page.click('#backupNowBtn');
    await page.waitForTimeout(400);
    await page.click('#modalOk');
    await page.waitForTimeout(2500);
    out.rowsAfterManual = await page.evaluate(() => document.querySelectorAll('#backupList tr').length);
    out.kvAfter = await page.evaluate(() => document.getElementById('backupKv').innerText.replace(/\n/g,' | ').slice(0,160));

    /* App 端 smoke：8765 能正常打开 */
    const app = await browser.newPage({ viewport: { width: 420, height: 900 } });
    app.on('pageerror', e => out.errs.push('APP ' + String(e).slice(0,140)));
    await app.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load' });
    await app.waitForTimeout(1200);
    await app.click('#guestBtn').catch(()=>{});
    await app.waitForTimeout(3500);
    out.app = await app.evaluate(() => ({ posts: document.querySelectorAll('.post').length, online: !!document.getElementById('netBar') && !document.getElementById('netBar').classList.contains('on') }));
  } catch (e) {
    out.errs.push('FATAL ' + String(e.message||e).slice(0,200));
  } finally {
    await browser.close().catch(()=>{});
    console.log(JSON.stringify(out, null, 1));
  }
})();
