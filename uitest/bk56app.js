
const { chromium } = require('playwright-core');
(async () => {
  const out = { errs: [] };
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox','--disable-gpu'] });
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  p.on('pageerror', e => out.errs.push(String(e).slice(0,140)));
  await p.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  await p.click('#guestBtn').catch(()=>{});
  await p.waitForTimeout(4000);
  out.posts = await p.evaluate(() => document.querySelectorAll('.post').length);
  out.badges = await p.evaluate(() => !!document.getElementById('netBar') && !document.getElementById('netBar').classList.contains('on'));
  out.srvPosts = await p.evaluate(async () => { try { const r = await fetch('http://127.0.0.1:8787/api/posts?limit=100'); const d = await r.json(); return (d.items||d.posts||[]).length; } catch(e) { return 'ERR ' + e.message; } });
  await p.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/bk56-app.png' });
  await b.close(); console.log(JSON.stringify(out));
})();
