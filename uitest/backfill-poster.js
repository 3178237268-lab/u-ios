
const { chromium } = require('playwright-core');
const VIDS = ['23a16b41ae999fc3c6a9a18d', 'db381dc8d1b9ccddccaf223d', 'bbb395dc498538376af39e53', 'f4ab0cf6ea83fee0bf0c5f5e', 'a4dec113c584f6ddc87ae9ae'];
const API = 'http://127.0.0.1:8787';
(async () => {
  let login = await (await fetch(API + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin123', password: 'admin123' }) })).json();
  if (!login.token) login = await (await fetch(API + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }) })).json();
  const token = login.token;
  if (!token) { console.log(JSON.stringify({ fatal: 'login', login })); return; }
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await (await browser.newPage({ viewport: { width: 480, height: 270 } })).goto(API + '/admin.html').then(() => null).catch(() => null);
  const pg = page || (await browser.newPage());
  await pg.goto(API + '/admin.html', { waitUntil: 'domcontentloaded' });
  const out = {};
  for (const id of VIDS) {
    const res = await pg.evaluate(async (id) => {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'metadata';
      v.style.cssText = 'position:fixed;left:0;top:0;width:320px;z-index:99999';
      document.body.appendChild(v);
      const wait = (ev, ms) => new Promise((r) => { const t = setTimeout(() => r(false), ms); v.addEventListener(ev, () => { clearTimeout(t); r(true); }, { once: true }); });
      v.src = '/media/' + id + '#t=0.1';
      const ok = await wait('loadeddata', 20000);
      if (!ok) { v.remove(); return { ok: false, rs: v.readyState }; }
      const c = document.createElement('canvas');
      const w = v.videoWidth, h = v.videoHeight;
      const sc = Math.min(1, 720 / Math.max(w, h));
      c.width = Math.round(w * sc); c.height = Math.round(h * sc);
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      const b64 = c.toDataURL('image/jpeg', 0.85).split(',')[1];
      v.remove();
      return { ok: true, b64, w, h };
    }, id);
    if (!res || !res.ok) { out[id] = { skipped: true, res }; continue; }
    const buf = Buffer.from(res.b64, 'base64');
    const up = await fetch(API + '/api/media/' + id + '/poster', { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'image/jpeg', 'x-ratio': String(res.w / res.h) }, body: buf });
    out[id] = { status: up.status, body: await up.text().then((t) => t.slice(0, 90)), kb: Math.round(buf.length / 1024), size: res.w + 'x' + res.h };
  }
  console.log(JSON.stringify(out));
  await browser.close();
})().catch((e) => console.log(JSON.stringify({ fatal: String(e).slice(0, 300) })));
