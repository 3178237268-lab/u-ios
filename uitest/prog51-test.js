
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('playwright-core');
const ROOT='D:/deepseek/gouzuoqu/U', PORT=18871;
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.png':'image/png','.css':'text/css'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const srv=http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/')p='/index.html';
  const f=path.join(ROOT,p);
  fs.readFile(f,(e,b)=>{ if(e){res.writeHead(404);res.end('no');return;} res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'}); res.end(b); });
});
(async()=>{
  await new Promise(r=>srv.listen(PORT,r));
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage({viewport:{width:420,height:900},deviceScaleFactor:2,hasTouch:true,isMobile:true});
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto('http://127.0.0.1:'+PORT+'/index.html',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>localStorage.setItem('u-server','http://127.0.0.1:8787'));
  await page.reload({waitUntil:'domcontentloaded'});
  await sleep(2500);
  await page.click('#guestBtn').catch(()=>{});
  await sleep(3000);
  for(let i=0;i<10;i++){ const n=await page.evaluate(()=>document.querySelectorAll('.post .pmedia .vgrid').length); if(n>3) break; await page.mouse.wheel(0,800); await sleep(800); }
  const opened=await page.evaluate(()=>{
    const b=[...document.querySelectorAll('.pmedia .vgexp')][0]; if(!b) return 'nobtn';
    b.click(); return 'ok';
  });
  await sleep(2600);
  const st1=await page.evaluate(()=>{
    const v=document.querySelector('#mvContent video'), box=document.querySelector('#mvOverlay');
    if(!v||!box) return {err:'noviewer'};
    return {scrub:!!box.querySelector('.mv-scrub'), buf:!!box.querySelector('.mv-prog b'), knob:!!box.querySelector('.mv-prog s'),
      bufW:box.querySelector('.mv-prog b')?box.querySelector('.mv-prog b').style.width:'', fillW:box.querySelector('.mv-prog i').style.width,
      dur:v.duration, t:v.currentTime, paused:v.paused};
  });
  console.log('OPEN',opened,JSON.stringify(st1));
  const rect=await page.evaluate(()=>{const s=document.querySelector('#mvOverlay .mv-scrub');const r=s.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height};});
  const y=rect.y+rect.h/2;
  await page.mouse.move(rect.x+rect.w*0.25,y); await page.mouse.down();
  await sleep(180);
  await page.mouse.move(rect.x+rect.w*0.6,y,{steps:8}); await sleep(260);
  const mid=await page.evaluate(()=>{const v=document.querySelector('#mvContent video'),box=document.querySelector('#mvOverlay');return {t:v.currentTime,dur:v.duration,paused:v.paused,drag:box.classList.contains('scrubbing'),fill:box.querySelector('.mv-prog i').style.width,rem:box.querySelector('.mv-remain').textContent};});
  await page.mouse.up(); await sleep(500);
  const after=await page.evaluate(()=>{const v=document.querySelector('#mvContent video'),box=document.querySelector('#mvOverlay');return {t:v.currentTime,dur:v.duration,paused:v.paused,drag:box.classList.contains('scrubbing'),rem:box.querySelector('.mv-remain').textContent,fill:box.querySelector('.mv-prog i').style.width,buf:box.querySelector('.mv-prog b').style.width,knob:box.querySelector('.mv-prog s').style.left};});
  console.log('DRAG',JSON.stringify(mid));
  console.log('AFTER',JSON.stringify(after));
  const scrubH=rect.h; console.log('SCRUB',JSON.stringify({w:Math.round(rect.w),h:Math.round(scrubH)}));
  await page.screenshot({path:'prog51.png'});
  console.log('ERRS',errs.slice(0,3));
  await browser.close(); srv.close(); process.exit(0);
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});