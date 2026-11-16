
const { chromium } = require('playwright-core');
const IDS = ['db381dc8d1b9ccddccaf223d'];
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 } })).newPage();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  let bytes = 0, reqs = 0, fails = [];
  cdp.on('Network.requestWillBeSent', () => reqs++);
  cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength || 0; });
  cdp.on('Network.loadingFailed', (e) => fails.push(e.errorText));
  await page.goto('http://127.0.0.1:8765/', { waitUntil: 'domcontentloaded' });
  const res = await page.evaluate(async (id) => {
    const src = location.origin + '/media/' + id;
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'metadata';
    v.style.cssText = 'position:fixed;z-index:9999;left:0;top:0;width:360px;background:#000';
    document.body.appendChild(v);
    const wait = (ev, ms) => new Promise((r) => { const t = setTimeout(() => r('timeout:' + ev), ms); v.addEventListener(ev, () => { clearTimeout(t); r(ev); }, { once: true }); });
    const started = performance.now();
    v.src = src + '#t=0.1';
    const a = await wait('loadeddata', 12000);
    const b = await wait('seeked', 6000);
    const c = document.createElement('canvas'); c.width = 200; c.height = 112;
    let painted = false, avg = 0;
    try { c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; avg = Math.round(s / (d.length / 4) / 3); painted = avg > 3; } catch (e) { painted = 'err'; }
    return { events: [a, b], readyState: v.readyState, dur: v.duration, vw: v.videoWidth, vh: v.videoHeight, painted, avg, ms: Math.round(performance.now() - started) };
  }, IDS[0]);
  await new Promise((r) => setTimeout(r, 500));
  console.log(JSON.stringify({ res, reqs, bytes, fails: fails.slice(0, 3) }));
  await browser.close();
})().catch((e) => console.log(JSON.stringify({ fatal: String(e).slice(0, 200) })));
