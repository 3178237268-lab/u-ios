
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'perf4-data');
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const PORT = 18944, SITE = 18774;
const S = 'http://127.0.0.1:' + PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), U_DISCOVER_PORT: '18774', U_DATA_DIR: DATA }, stdio: 'ignore' });
const serve = (htmlPath) => (req, res) => {
  fs.readFile(htmlPath, (e, b) => { if (e) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(b); });
};
const s1 = http.createServer(serve(path.join(ROOT, 'index.html'))).listen(SITE);
const s2 = http.createServer(serve(path.join(ROOT, '.tmp-test', 'old-index.html'))).listen(SITE + 1);
let browser;
async function run(port, throttle) {
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
  await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load', timeout: 60000 });
  await page.evaluate((s) => { localStorage.setItem('u-server', s); }, S);
  await page.reload({ waitUntil: 'load' }); await sleep(500);
  await page.evaluate(() => { const b = document.querySelector('#guestBtn'); if (b) b.click(); });
  await sleep(3500);
  // publish 3 posts containing 好
  await page.evaluate(async () => {
    const t = localStorage.getItem('u-server-token');
    for (const txt of ['晚霞很好看 好天气', '好好生活 hello', '别的帖子']) {
      await fetch(localStorage.getItem('u-server') + '/api/posts', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: JSON.stringify({ text: txt }) });
    }
  });
  await page.evaluate(() => { const t = document.querySelector('.tab[data-tab="search"]'); if (t) t.click(); });
  await sleep(1500);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await page.evaluate(() => {
    window.__stats = []; window.__writes = 0; let pending = null;
    const box = document.querySelector('#searchSug');
    window.__obs = new MutationObserver(() => { window.__writes++; if (pending != null) { window.__stats.push(Math.round(performance.now() - pending)); pending = null; } });
    window.__obs.observe(box, { childList: true, subtree: true, characterData: true });
    document.querySelector('#searchInput').addEventListener('input', () => { pending = performance.now(); });
    document.querySelector('#searchInput').focus();
  });
  for (const ch of ['好', '天', '气']) { await page.keyboard.type(ch, { delay: 0 }); await sleep(700); }
  const stats = await page.evaluate(() => ({ lat: window.__stats, writes: window.__writes }));
  const dom = await page.evaluate(() => {
    const drop = document.querySelector('#searchDrop'); const cs = getComputedStyle(drop);
    return { rows: document.querySelectorAll('#searchSug .sug-row').length, openH: Math.round(drop.getBoundingClientRect().height), maxH: cs.maxHeight, transition: cs.transitionProperty, contains: cs.contain };
  });
  await page.screenshot({ path: path.join(ROOT, '.tmp-test', 'search-perf-' + port + '.png') });
  await page.context().close();
  return { port, throttle, lat: stats.lat, writes: stats.writes, dom, errs };
}
(async () => {
  for (let i = 0; i < 90; i++) { try { if ((await fetch(S + '/api/config')).ok) break; } catch (e) {} await sleep(150); }
  browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const neu = await run(SITE, 8);
  const oldr = await run(SITE + 1, 8);
  console.log(JSON.stringify({ neu, old: oldr }));
})().catch((e) => console.log(JSON.stringify({ fatal: String(e).slice(0, 200) }))).finally(async () => { try { await browser.close(); } catch (e) {} s1.close(); s2.close(); srv.kill(); });
