const {chromium}=require('playwright-core'); const http=require('http'); const fs=require('fs'); const path=require('path');
const ROOT='D:/deepseek/gouzuoqu/U'; const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css'};
const srv=http.createServer((q,s)=>{ const u=decodeURIComponent(q.url.split('?')[0]); const p=path.join(ROOT,u==='/'?'index.html':u.replace(/^\//,''));
  fs.readFile(p,(e,b)=>{ if(e){s.writeHead(404);s.end('no');return;} s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); s.end(b);});});
(async()=>{ await new Promise(r=>srv.listen(18892,'127.0.0.1',r));
 const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
 const page=await b.newPage({viewport:{width:420,height:900}}); const errs=[]; page.on('pageerror',x=>errs.push(String(x).slice(0,140)));
 await page.goto('http://127.0.0.1:18892/index.html',{waitUntil:'load'}); await page.waitForTimeout(1000);
 await page.evaluate(()=>localStorage.setItem('u-server','http://127.0.0.1:8787'));
 await page.reload({waitUntil:'load'}); await page.waitForTimeout(1200); await page.click('#guestBtn').catch(()=>{}); await page.waitForTimeout(1500);
 await page.evaluate(()=>{ const p=document.querySelector('#feedList .post .pmedia .vgexp'); if(p) p.click(); });
 await page.waitForTimeout(1500);
 const m=await page.evaluate(()=>{
   const vh=innerHeight; const q=s=>document.querySelector(s);
   const box=s=>{const el=q(s); if(!el) return null; const r=el.getBoundingClientRect(); return {top:Math.round(r.top),bottom:Math.round(r.bottom),h:Math.round(r.height),fromBottom:Math.round(vh-r.bottom)};};
   return {vh, open:q('#mediaViewer').classList.contains('open'), next:!!q('[data-mvact=\"next\"]'), nextBtn:!!q('.mv-nextbtn'),
     ctl:box('.mv-ctl'), scrub:box('.mv-scrub'), prog:box('.mv-prog'), remain:box('.mv-remain'), dots:box('.mv-bot')};});
 await page.screenshot({path:ROOT+'/.tmp-test/mv53-bar.png'});
 console.log(JSON.stringify({m,errs}));
 await b.close(); srv.close();
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});