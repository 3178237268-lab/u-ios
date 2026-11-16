const { chromium } = require('playwright-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const b = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox','--disable-gpu'] });
  const p = await b.newPage();
  await p.goto('http://127.0.0.1:8787/admin.html', { waitUntil: 'domcontentloaded' });
  const out = await p.evaluate((id) => new Promise((resolve) => {
    const log = [];
    const v = document.createElement('video');
    v.muted = true; v.preload = 'auto';
    ['loadstart','progress','loadedmetadata','loadeddata','canplay','error','stalled','suspend'].forEach(ev => v.addEventListener(ev, () => log.push(ev + ' rs=' + v.readyState + ' ns=' + v.networkState + (v.error ? ' err=' + v.error.code : ''))));
    setTimeout(() => resolve({ log, rs: v.readyState, dur: v.duration, w: v.videoWidth, h: v.videoHeight, err: v.error && v.error.code }), 20000);
    v.src = '/media/' + id + '#t=0.1';
    v.load();
  }), '4260c21df103f8c228611c17');
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
