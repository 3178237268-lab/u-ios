
const { chromium } = require('playwright-core');
const SITE='http://127.0.0.1:8765/index.html', API='http://127.0.0.1:8787';
(async()=>{
  const out={errs:[],net:[]};
  const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
  const p=await b.newPage({viewport:{width:420,height:900},deviceScaleFactor:2});
  p.on('pageerror',e=>out.errs.push(String(e).slice(0,140)));
  p.on('console',m=>{if(m.type()==='error')out.errs.push('c:'+m.text().slice(0,120));});
  p.on('response',r=>{if(r.status()>=400)out.net.push(r.status()+' '+r.url().slice(0,70));});
  await p.goto(SITE,{waitUntil:'load'});
  await p.evaluate(s=>localStorage.setItem('u-server',s),API);
  await p.reload({waitUntil:'load'}); await p.waitForTimeout(900);
  await p.click('#guestBtn'); await p.waitForTimeout(4000);
  out.feed=await p.locator('#feedList .post').count();
  await p.locator('.feedtab[data-home="talk"]').click(); await p.waitForTimeout(2500);
  out.talk=await p.locator('#talkList .post').count();
  await p.locator('.feedtab[data-home="feed"]').click(); await p.waitForTimeout(1500);
  const P=p.locator('#feedList .post').filter({has: p.locator('.pmedia .vplayer.vgrid')}).first();
  out.gridPost=await P.count();
  if (out.gridPost) {
    const v=await P.locator('.pveil-btn'); if(await v.count()) { await v.click(); await p.waitForTimeout(700); }
    out.posters=await P.locator('.vplayer.vgrid video').evaluateAll(async(vs)=>{const r=[];for(const vv of vs){const s=vv.getAttribute('poster')||'';r.push(await new Promise(res=>{if(!s)return res('none');const im=new Image();im.onload=()=>res(im.naturalWidth+'x'+im.naturalHeight);im.onerror=()=>res('ERR');im.src=s;setTimeout(()=>res('T'),8000);}));}return r;});
    const st=await P.locator('.vplayer.vgrid .vstage').first().boundingBox();
    await p.mouse.click(st.x+st.width/2, st.y+st.height/2); await p.waitForTimeout(2500);
    out.viewer=await p.evaluate(()=>{const v=document.querySelector('#mvContent video');return {open:document.getElementById('mediaViewer').classList.contains('open'),count:(document.getElementById('mvCount')||{}).textContent,vw:v?v.videoWidth:-1,t:v?+v.currentTime.toFixed(2):-1};});
    await p.screenshot({path:'D:/deepseek/gouzuoqu/U/.tmp-test/final57-viewer.png'});
    await p.click('#mvClose').catch(()=>{});
  }
  await p.screenshot({path:'D:/deepseek/gouzuoqu/U/.tmp-test/final57-feed.png'});
  console.log(JSON.stringify(out,null,1).slice(0,2000));
  await b.close();
})();
