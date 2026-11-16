
const { chromium } = require('playwright-core');
const SITE='http://127.0.0.1:8765/index.html', API='http://127.0.0.1:8787', MARK='E2E57';
(async()=>{
  const out={errs:[],net:[]};
  const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
  const p=await b.newPage({viewport:{width:420,height:900},deviceScaleFactor:2});
  p.on('pageerror',e=>out.errs.push(String(e).slice(0,160)));
  p.on('console',m=>{ if(m.type()==='error') out.errs.push('console:'+m.text().slice(0,140)); });
  p.on('response',r=>{ if(r.status()>=400) out.net.push(r.status()+' '+r.url().slice(0,80)); });
  await p.goto(SITE,{waitUntil:'load'});
  await p.evaluate(s=>localStorage.setItem('u-server',s),API);
  await p.reload({waitUntil:'load'}); await p.waitForTimeout(900);
  await p.fill('#authUser','viewer57'); await p.fill('#authPass','viewer123'); await p.click('#authSubmit');
  await p.waitForTimeout(4000);
  out.feed=await p.locator('#feedList .post').count();
  /* 说说 tab */
  await p.locator('.feedtab[data-home="talk"]').click(); await p.waitForTimeout(2500);
  out.talk=await p.locator('#talkList .post').count();
  await p.locator('.feedtab[data-home="feed"]').click(); await p.waitForTimeout(2000);
  /* 六视频帖 */
  const P=p.locator('.post').filter({hasText:MARK}).first();
  await P.scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  out.veil=await P.locator('.pveil').count();
  await P.locator('.pveil-btn').click(); await p.waitForTimeout(800);
  out.mediaCls=await P.locator('.pmedia').getAttribute('class');
  out.posters=await P.locator('.vplayer.vgrid video').evaluateAll(async(vs)=>{
    const res=[]; for(const v of vs){ const s=v.getAttribute('poster')||''; res.push(await new Promise(r=>{ if(!s) return r('none'); const im=new Image(); im.onload=()=>r(im.naturalWidth+'x'+im.naturalHeight); im.onerror=()=>r('ERR'); im.src=s; setTimeout(()=>r('TIMEOUT'),9000); })); } return res; });
  /* 点第一格 -> 查看器 */
  const st=await P.locator('.vplayer.vgrid .vstage').first().boundingBox();
  await p.mouse.click(st.x+st.width/2, st.y+st.height/2);
  await p.waitForTimeout(2500);
  out.viewer=await p.evaluate(()=>{const v=document.querySelector('#mvContent video'); return {open:document.getElementById('mediaViewer').classList.contains('open'), count:(document.getElementById('mvCount')||{}).textContent, vw:v?v.videoWidth:-1, t:v?+v.currentTime.toFixed(2):-1, err:v&&v.error&&v.error.code, pills:document.querySelectorAll('#mvOverlay .mv-pill').length};});
  /* 上下滑切下一个 */
  const vp=await p.evaluate(()=>{const r=document.getElementById('mvStage').getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};});
  await p.mouse.move(vp.x,vp.y); await p.mouse.down(); await p.mouse.move(vp.x,vp.y-160,{steps:8}); await p.mouse.up();
  await p.waitForTimeout(2000);
  out.afterSwipe=await p.evaluate(()=>({count:(document.getElementById('mvCount')||{}).textContent, t:(()=>{const v=document.querySelector('#mvContent video'); return v?+v.currentTime.toFixed(2):-1;})()}));
  await p.screenshot({path:'D:/deepseek/gouzuoqu/U/.tmp-test/e2e57-final-viewer.png'});
  await p.keyboard.press('Escape').catch(()=>{});
  await p.click('#mvClose').catch(()=>{});
  await p.waitForTimeout(600);
  /* 图片帖 1166 */
  out.image=await p.evaluate(async()=>{
    const posts=await (await fetch('http://127.0.0.1:8787/api/posts?limit=50')).json();
    const it=(posts.items||[]).find(x=>(x.media||[]).some(m=>/^image\//.test(m.mime)));
    return it? {id:it.id} : null;
  });
  console.log(JSON.stringify(out,null,1).slice(0,4000));
  await b.close();
})();
