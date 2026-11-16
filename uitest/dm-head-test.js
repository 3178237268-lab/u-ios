
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'ui-dm-data');
fs.rmSync(DATA, { recursive: true, force: true });
fs.mkdirSync(DATA, { recursive: true });
const PORT = 18911, S = 'http://127.0.0.1:' + PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18798', U_DATA_DIR: DATA }, stdio: 'ignore' });
let pass = 0, fail = 0;
const ok = (c, n, x) => { if (c) pass++; else { fail++; console.log('FAIL ' + n + ' :: ' + JSON.stringify(x)); } };
(async () => {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.goto('http://127.0.0.1:8765/', { waitUntil: 'load', timeout: 40000 });
  await page.evaluate((s) => localStorage.setItem('u-server', s), S);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1800);
  await page.click('#guestBtn').catch(() => {});
  await page.waitForTimeout(2200);

  const head = await page.evaluate(() => {
    const h = document.querySelector('#dmSheet .sheet-head');
    if (!h) return 'missing';
    return {
      avatars: h.querySelectorAll('.avatar').length,
      peerBtn: !!h.querySelector('#dmPeerBtn'),
      kids: h.children.length,
      texts: Array.from(h.querySelectorAll('button,span')).map((n) => (n.textContent || '').trim()).filter(Boolean),
    };
  });
  ok(head !== 'missing', 'dm sheet exists', head);
  ok(head.avatars === 0, 'no avatar in dm header', head.avatars);
  ok(head.peerBtn === false, 'dmPeerBtn removed', head.peerBtn);
  ok(errs.length === 0, 'no page errors on dm tab', errs.slice(0, 3));

  await page.click('.tab[data-tab="dm"]');
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => { const h = document.querySelector('#dmSheet .sheet-head'); return h ? h.querySelectorAll('.avatar').length : 'missing'; });
  ok(after === 0, 'still no avatar after opening dm tab', after);
  console.log(JSON.stringify({ pass, fail, errs: errs.slice(0, 3), head }));
  await browser.close(); srv.kill(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('ERR ' + (e && e.stack || e)); try { srv.kill(); } catch (x) {} process.exit(2); });
