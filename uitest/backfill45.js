const { chromium } = require('playwright-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:8787';
const IDS = process.argv.slice(2);

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox','--disable-gpu'] });
  const page = await browser.newPage();
  await page.goto(BASE + '/admin.html', { waitUntil: 'domcontentloaded' });
  const out = await page.evaluate(async (ids) => {
    const login = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin123', password: 'admin123' }) }).then(r => r.json());
    if (!login.token) return { error: 'login failed', login };
    const token = login.token;
    const TS = [0.1, 0.6, 1.2, 2.4, 4.0];
    const grabOne = (id, t) => new Promise((resolve) => {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto';
      let done = false;
      const finish = (r) => { if (done) return; done = true; try { v.removeAttribute('src'); v.load(); } catch (e) {} resolve(r); };
      const timer = setTimeout(() => finish(null), 20000);
      v.addEventListener('loadeddata', () => {
        const w = v.videoWidth, h = v.videoHeight;
        if (!w || !h) { clearTimeout(timer); return finish(null); }
        const c = document.createElement('canvas');
        const s = Math.min(1, 720 / Math.max(w, h));
        c.width = Math.round(w * s); c.height = Math.round(h * s);
        const ctx = c.getContext('2d');
        ctx.drawImage(v, 0, 0, c.width, c.height);
        let mean = -1;
        try {
          const d = ctx.getImageData(0, 0, c.width, c.height).data;
          let sum = 0, n = 0;
          for (let i = 0; i < d.length; i += 4 * 53) { sum += d[i]*0.299 + d[i+1]*0.587 + d[i+2]*0.114; n++; }
          mean = n ? sum / n : -1;
        } catch (e) { clearTimeout(timer); return finish(null); }
        let url = '';
        try { url = c.toDataURL('image/jpeg', 0.82); } catch (e) { clearTimeout(timer); return finish(null); }
        clearTimeout(timer);
        finish({ mean, url, ratio: w / h, w, h });
      }, { once: true });
      v.addEventListener('error', () => { clearTimeout(timer); finish(null); }, { once: true });
      v.src = '/media/' + id + '#t=' + t;
    });
    const results = [];
    for (const id of ids) {
      let best = null;
      for (const t of TS) {
        const r = await grabOne(id, t);
        if (!r) continue;
        if (!best || r.mean > best.mean) best = r;
        if (r.mean >= 20) { best = r; break; }
      }
      if (!best) { results.push({ id, ok: false, reason: 'no frame' }); continue; }
      const bin = atob(best.url.split(',')[1]);
      const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      const blob = new Blob([buf], { type: 'image/jpeg' });
      const res = await fetch('/api/media/' + id + '/poster', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'image/jpeg', 'X-Ratio': String(best.ratio) }, body: blob });
      const j = await res.json().catch(() => ({}));
      results.push({ id, ok: res.status === 201, status: res.status, mean: Math.round(best.mean), bytes: buf.length, poster: j.poster, ratio: j.ratio });
    }
    return { token: !!token, results };
  }, IDS);
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
