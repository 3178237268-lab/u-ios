
const { chromium } = require('playwright-core');
const SITE='http://127.0.0.1:8765/index.html', API='http://127.0.0.1:8787', MARK='E2E57';
(async()=>{
  const out={errs:[],steps:[]};
  const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
  const p=await b.newPage({viewport:{width:420,height:900},deviceScaleFactor:2});
  p.on('pageerror',e=>out.errs.push(String(e).slice(0,150)));
  p.on('response',r=>{ if(r.status()>=400) out.errs.push(r.status()+' '+r.url().slice(0,70)); });
  await p.goto(SITE,{waitUntil:'load'});
  await p.evaluate(s=>localStorage.setItem('u-server',s),API);
  await p.reload({waitUntil:'load'}); await p.waitForTimeout(900);
  await p.fill('#authUser','viewer57'); await p.fill('#authPass','viewer123'); await p.click('#authSubmit'); await p.waitForTimeout(3500);
  const P = p.locator('.post').filter({ hasText: MARK }).first();
  await P.scrollIntoViewIfNeeded(); await p.waitForTimeout(500);
  out.steps.push('posts=' + await p.locator('.post').count());
  await P.locator('.pveil-btn').click();
  await p.waitForTimeout(900);
  out.reveal = await P.locator('.pmedia').getAttribute('class');
  out.pe = await P.locator('.vplayer.vgrid .vstage').first().evaluate(e=>getComputedStyle(e).pointerEvents);
  /* 点第一个格子中央 */
  const stage = P.locator('.vplayer.vgrid .vstage').first();
  const bb = await stage.boundingBox();
  await p.mouse.click(bb.x + bb.width/2, bb.y + bb.height/2);
  for (let i=0;i<10;i++){ await p.waitForTimeout(600);
    const s = await P.locator('.vplayer.vgrid video').first().evaluate(v=>({t:+v.currentTime.toFixed(2),rs:v.readyState,w:v.videoWidth,paused:v.paused,src:(v.getAttribute('src')||'').slice(-24)}));
    out.steps.push(JSON.stringify(s)); if (s.t>0.3 && s.w>0) break;
  }
  out.inline = await P.locator('.vplayer.vgrid video').first().evaluate(v=>({t:+v.currentTime.toFixed(2),rs:v.readyState,w:v.videoWidth,paused:v.paused,err:v.error&&v.error.code}));
  await p.screenshot({path:'D:/deepseek/gouzuoqu/U/.tmp-test/e2e57-inline.png'});
  /* 放大按钮 */
  const btn = P.locator('.vplayer.vgrid .vgexp').first();
  try { await btn.click({ timeout: 8000 }); out.steps.push('vgexp click ok'); }
  catch (e) {
    out.steps.push('vgexp FAIL ' + String(e.message).slice(0,160));
    out.hitTest = await btn.evaluate(el => { const r = el.getBoundingClientRect(); const t = document.elementFromPoint(r.x+r.width/2, r.y+r.height/2); return { rect:[Math.round(r.x),Math.round(r.y)], hit: t ? t.tagName+'.'+(t.className.baseVal!==undefined?t.className.baseVal:t.className) : null }; });
    await btn.click({ force: true }).catch(()=>{});
  }
  await p.waitForTimeout(2500);
  out.viewer = await p.evaluate(()=>{const v=document.querySelector('#mvContent video'); return {open:document.getElementById('mediaViewer').classList.contains('open'), count:(document.getElementById('mvCount')||{}).textContent, vw:v?v.videoWidth:-1, t:v?+v.currentTime.toFixed(2):-1, err:v&&v.error&&v.error.code};});
  await p.screenshot({path:'D:/deepseek/gouzuoqu/U/.tmp-test/e2e57-viewer.png'});
  console.log(JSON.stringify(out,null,1).slice(0,4000));
  await b.close();
})();
