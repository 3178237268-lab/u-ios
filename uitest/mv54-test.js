const {chromium}=require('playwright-core'); const http=require('http'); const fs=require('fs'); const path=require('path');
const ROOT='D:/deepseek/gouzuoqu/U'; const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css'};
const srv=http.createServer((q,s)=>{ const u=decodeURIComponent(q.url.split('?')[0]); const p=path.join(ROOT,u==='/'?'index.html':u.replace(/^\//,''));
  fs.readFile(p,(e,b)=>{ if(e){s.writeHead(404);s.end('no');return;} s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); s.end(b);});});
(async()=>{ await new Promise(r=>srv.listen(18894,'127.0.0.1',r));
 const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
 const page=await b.newPage({viewport:{width:420,height:900}}); const errs=[]; page.on('pageerror',x=>errs.push(String(x).slice(0,140)));
 await page.goto('http://127.0.0.1:18894/index.html',{waitUntil:'load'}); await page.waitForTimeout(900);
 await page.evaluate(()=>localStorage.setItem('u-server','http://127.0.0.1:8787'));
 await page.reload({waitUntil:'load'}); await page.waitForTimeout(1200); await page.click('#guestBtn').catch(()=>{}); await page.waitForTimeout(1600);
 const opened=await page.evaluate(()=>{ const veils=[...document.querySelectorAll('#feedList .post .pmedia .pveil')]; const v=veils.find(x=>x.closest('.pmedia').classList.contains('mm')); if(v){v.click();return 'veil';} return 'none'; });
 await page.waitForTimeout(700);
 const opened2=await page.evaluate(()=>{ const grid=[...document.querySelectorAll('#feedList .pmedia .vgexp')]; if(!grid.length) return 'nogrid'; grid[grid.length-1].click(); return 'grid'; });
 await page.waitForTimeout(1600);
 const s1=await page.evaluate(()=>{ const mv=document.getElementById('mediaViewer'); return {open:mv.classList.contains('open'),vswipe:mv.classList.contains('vswipe'),count:document.getElementById('mvCount').textContent,navVisible:[...document.querySelectorAll('.mv-nav')].map(n=>getComputedStyle(n).display)}; });
 const stage=await page.evaluate(()=>{const r=document.getElementById('mvStage').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,h:r.height};});
 /* drag up = next */
 await page.mouse.move(stage.x, stage.y+120); await page.mouse.down();
 await page.mouse.move(stage.x, stage.y-40,{steps:10}); await page.waitForTimeout(120);
 const midDrag=await page.evaluate(()=>{const c=document.getElementById('mvContent');return {tf:c.style.transform,op:c.style.opacity};});
 await page.mouse.up(); await page.waitForTimeout(700);
 const afterUp=await page.evaluate(()=>({count:document.getElementById('mvCount').textContent,tf:document.getElementById('mvContent').style.transform}));
 /* wheel down = next */
 await page.mouse.move(stage.x, stage.y); await page.mouse.wheel(0, 120); await page.waitForTimeout(600);
 const afterWheel=await page.evaluate(()=>document.getElementById('mvCount').textContent);
 /* key ArrowUp = prev */
 await page.keyboard.press('ArrowUp'); await page.waitForTimeout(400);
 const afterKey=await page.evaluate(()=>document.getElementById('mvCount').textContent);
 /* scrub still draggable */
 const box=await page.evaluate(()=>{const r=document.querySelector('.mv-scrub').getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};});
 await page.mouse.move(box.x+box.w*0.2, box.y+box.h/2); await page.mouse.down(); await page.mouse.move(box.x+box.w*0.5, box.y+box.h/2,{steps:5}); await page.waitForTimeout(200);
 const scrub=await page.evaluate(()=>{const v=document.querySelector('#mvContent video');return {cur:Math.round(v.currentTime),dur:Math.round(v.duration),paused:v.paused};});
 await page.mouse.up();
 await page.screenshot({path:ROOT+'/.tmp-test/mv54-swipe.png'});
 console.log(JSON.stringify({opened,opened2,s1,midDrag,afterUp,afterWheel,afterKey,scrub,errs}));
 await b.close(); srv.close();
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});