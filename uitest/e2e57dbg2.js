
const { chromium } = require('playwright-core');
const SITE='http://127.0.0.1:8765/index.html', API='http://127.0.0.1:8787', MARK='E2E57';
(async()=>{
  const out={};
  const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
  const p=await b.newPage({viewport:{width:420,height:900}});
  const logs=[]; p.on('console',m=>logs.push(m.type()+':'+m.text().slice(0,120))); p.on('pageerror',e=>logs.push('pageerror:'+String(e).slice(0,140)));
  await p.goto(SITE,{waitUntil:'load'});
  await p.evaluate(s=>localStorage.setItem('u-server',s),API);
  await p.reload({waitUntil:'load'}); await p.waitForTimeout(900);
  await p.fill('#authUser','viewer57'); await p.fill('#authPass','viewer123'); await p.click('#authSubmit'); await p.waitForTimeout(3500);
  await p.evaluate((m)=>{const el=Array.from(document.querySelectorAll('.post')).find(a=>(a.textContent||'').indexOf(m)>=0); el && el.scrollIntoView({block:'center'});},MARK);
  await p.waitForTimeout(600);
  const pid=await p.evaluate((m)=>(Array.from(document.querySelectorAll('.post')).find(a=>(a.textContent||'').indexOf(m)>=0)||{}).dataset?.id,MARK);
  out.pid=pid;
  out.state1=await p.evaluate((id)=>{const p2=document.querySelector('.post[data-id="'+id+'"]'); const pm=p2.querySelector('.pmedia'); const v=p2.querySelector('.vplayer.vgrid video'); const st=p2.querySelector('.vplayer.vgrid .vstage');
    const veil=p2.querySelector('.pveil');
    return {pm:pm.className, veil:veil&&veil.className, peStage:getComputedStyle(st).pointerEvents, peVideo:getComputedStyle(v).pointerEvents, peBig:getComputedStyle(p2.querySelector('.vbigplay')).pointerEvents};},pid);
  /* JS 派发点击 */
  out.jsClick=await p.evaluate((id)=>{const p2=document.querySelector('.post[data-id="'+id+'"]'); const st=p2.querySelector('.vplayer.vgrid .vstage'); st.click(); return true;},pid);
  await p.waitForTimeout(1500);
  out.afterJs=await p.evaluate((id)=>{const v=document.querySelector('.post[data-id="'+id+'"] .vplayer.vgrid video'); return {src:(v.getAttribute('src')||'').slice(-26),rs:v.readyState,t:+v.currentTime.toFixed(2),paused:v.paused};},pid);
  /* 真实鼠标点击 */
  const box=await p.evaluate((id)=>{const r=document.querySelector('.post[data-id="'+id+'"] .vplayer.vgrid .vstage').getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),top:Math.round(r.y)};},pid);
  out.box=box;
  await p.mouse.click(box.x,box.y); await p.waitForTimeout(2000);
  out.afterMouse=await p.evaluate((id)=>{const v=document.querySelector('.post[data-id="'+id+'"] .vplayer.vgrid video'); return {src:(v.getAttribute('src')||'').slice(-26),rs:v.readyState,t:+v.currentTime.toFixed(2),paused:v.paused,w:v.videoWidth};},pid);
  out.logs=logs.slice(-12);
  console.log(JSON.stringify(out,null,1).slice(0,3000));
  await b.close();
})();
