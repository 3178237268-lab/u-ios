
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = 'D:/deepseek/gouzuoqu/U';
const TEMP = path.join(ROOT, '.tmp-test', 'bk56ui');
const PORT = 18962;
const B = 'http://127.0.0.1:' + PORT;
function rm(p){ try { fs.rmSync(p, { recursive: true, force: true }); } catch(e){} }
function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }
(async () => {
  rm(TEMP); fs.mkdirSync(TEMP, { recursive: true }); fs.mkdirSync(path.join(TEMP,'media'), { recursive: true });
  fs.writeFileSync(path.join(TEMP,'media','m1'), Buffer.alloc(5000, 3));
  fs.writeFileSync(path.join(TEMP,'media','m2'), Buffer.alloc(3000, 4));
  const child = spawn(process.execPath, [path.join(ROOT, 'server/src/server.js')], {
    env: Object.assign({}, process.env, { PORT: String(PORT), HOST: '127.0.0.1', U_DISCOVER_PORT: '18762', U_DATA_DIR: TEMP, ADMIN_USER: 'admin123', ADMIN_PASS: 'admin123' }),
    stdio: ['ignore','pipe','pipe']
  });
  let boot = ''; child.stdout.on('data', b => boot += b); child.stderr.on('data', b => boot += b);
  const out = { errs: [], console: [] };
  let browser = null;
  try {
    for (let i = 0; i < 40; i++) { try { const r = await fetch(B + '/api/config'); if (r.ok) break; } catch(e){} await wait(400); }
    browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox','--disable-gpu'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', e => out.errs.push(String(e).slice(0,160)));
    page.on('console', m => { if (m.type() === 'error') out.console.push(m.text().slice(0,160)); });
    await page.goto(B + '/admin', { waitUntil: 'load' });
    await wait(800);
    await page.fill('#lgUser', 'admin123');
    await page.fill('#lgPass', 'admin123');
    await page.click('#loginForm button[type=submit]');
    await wait(2000);
    out.loggedIn = await page.evaluate(() => !document.getElementById('login').classList.contains('login') || document.getElementById('login').classList.contains('hide'));

    await page.click('.tab[data-tab="settings"]');
    await wait(1200);
    out.setFields = await page.evaluate(() => ({
      hours: document.getElementById('setAutoBackupHours').value,
      keep: document.getElementById('setBackupKeep').value
    }));
    await page.fill('#setAutoBackupHours', '12');
    await page.fill('#setBackupKeep', '3');
    await page.click('#saveSettingsBtn');
    await wait(1500);
    out.savedToast = await page.evaluate(() => document.getElementById('toast').textContent.trim().slice(0,90));
    out.savedSettings = await page.evaluate(async () => {
      const t = localStorage.getItem('u-admin-token') || '';
      const r = await fetch('/api/admin/settings', { headers: { Authorization: 'Bearer ' + t } });
      const d = await r.json();
      return { autoBackupHours: d.settings && d.settings.autoBackupHours, backupKeep: d.settings && d.settings.backupKeep };
    });

    await page.click('.tab[data-tab="overview"]');
    await wait(900);
    await page.click('#backupNowBtn');
    await wait(500);
    out.modalText = await page.evaluate(() => document.getElementById('modalText').textContent.slice(0,80));
    await page.click('#modalOk');
    await wait(2500);
    out.kv = await page.evaluate(() => document.getElementById('backupKv').innerText.replace(/\n/g, ' | ').slice(0, 220));
    out.rows = await page.evaluate(() => Array.from(document.querySelectorAll('#backupList tr')).map(tr => tr.innerText.replace(/\n/g,' / ').slice(0,140)));
    out.rowButtons = await page.evaluate(() => ({
      res: document.querySelectorAll('#backupList [data-bkres]').length,
      del: document.querySelectorAll('#backupList [data-bkdel]').length
    }));
    out.dirs = fs.readdirSync(path.join(TEMP,'backup')).filter(n => fs.statSync(path.join(TEMP,'backup',n)).isDirectory());
    out.dirFiles = out.dirs.length ? fs.readdirSync(path.join(TEMP,'backup', out.dirs[0])).sort() : null;

    /* 点行内「恢复」 */
    await page.click('#backupList [data-bkres]');
    await wait(400);
    out.restoreModal = await page.evaluate(() => document.getElementById('modalText').textContent.slice(0,80));
    await page.click('#modalOk');
    await wait(2600);
    out.restoreToast = await page.evaluate(() => document.getElementById('toast').textContent.trim().slice(0,90));
    out.mediaAfterRestore = fs.readdirSync(path.join(TEMP,'media')).sort();

    /* 删除全部备份 */
    let guard = 0;
    while (guard < 4) {
      const has = await page.$('#backupList [data-bkdel]');
      if (!has) break;
      await has.click();
      await wait(400);
      await page.click('#modalOk');
      await wait(1400);
      guard += 1;
    }
    out.rowsAfterDelete = await page.evaluate(() => document.querySelectorAll('#backupList tr').length);
    out.listTextAfterDelete = await page.evaluate(() => (document.getElementById('backupList').innerText || '').replace(/\n/g,' / ').slice(0,80));
    out.restoreBtnDisabled = await page.evaluate(() => document.getElementById('restoreAppDataBtn').disabled);
  } catch (e) {
    out.errs.push('FATAL ' + String(e.message || e).slice(0,200));
  } finally {
    if (browser) await browser.close().catch(()=>{});
    try { child.kill(); } catch(e){}
    await wait(500);
    console.log(JSON.stringify(out, null, 1));
  }
})();
