const {chromium}=require('playwright-core'); const http=require('http'); const fs=require('fs'); const path=require('path');
const ROOT='D:/deepseek/gouzuoqu/U'; const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'};
const srv=http.createServer((q,s)=>{ const u=decodeURIComponent(q.url.split('?')[0]); const p=path.join(ROOT,u==='/'?'index.html':u.replace(/^\//,''));
  fs.readFile(p,(e,b)=>{ if(e){s.writeHead(404);s.end('no');return;} s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); s.end(b);});});
(async()=>{ await new Promise(r=>srv.listen(18888,'127.0.0.1',r));
 const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
 const ctx=await b.newContext({viewport:{width:420,height:900},deviceScaleFactor:1}); const page=await ctx.newPage();
 const errs=[]; page.on('pageerror',x=>errs.push(String(x).slice(0,140)));
 await page.goto('http://127.0.0.1:18888/index.html',{waitUntil:'load'}); await page.waitForTimeout(1000);
 await page.evaluate(()=>localStorage.setItem('u-server','http://127.0.0.1:8787'));
 await page.reload({waitUntil:'load'}); await page.waitForTimeout(1200);
 await page.click('#guestBtn').catch(()=>{}); await page.waitForTimeout(1500);
 const r={};
 r.postsBefore=await page.evaluate(()=>document.querySelectorAll('#feedList .post').length);
 await ctx.setOffline(true); await page.waitForTimeout(1500);
 r.offBar=await page.evaluate(()=>{const el=document.getElementById('netBar');const cs=getComputedStyle(el);const rc=el.getBoundingClientRect();
   return {on:el.classList.contains('on'),opacity:cs.opacity,txt:el.textContent.trim().slice(0,30),bottom:Math.round(rc.bottom),vw:innerWidth};});
 r.onLine=await page.evaluate(()=>navigator.onLine);
 r.bodyClass=await page.evaluate(()=>document.body.className);
 await page.screenshot({path:ROOT+'/.tmp-test/net-offline.png'});
 // 点赞应被拦下
 const likeSel='#feedList .post .pactions .like';
 await page.click(likeSel); await page.waitForTimeout(400);
 r.like=await page.evaluate(()=>{const b=document.querySelector('#feedList .post .pactions .like');return {on:b.classList.contains('on'),toast:document.getElementById('toast').textContent.trim(),toastOn:document.getElementById('toast').classList.contains('on')};});
 // 发帖应被拦下
 await page.click('#composeBtn'); await page.waitForTimeout(500);
 await page.fill('#composeText','离线测试别发出去');
 await page.waitForTimeout(300);
 await page.click('#composePublish'); await page.waitForTimeout(600);
 r.publish=await page.evaluate(()=>({toast:document.getElementById('toast').textContent.trim(),sheetOpen:document.getElementById('composeSheet').classList.contains('open')}));
 await page.screenshot({path:ROOT+'/.tmp-test/net-offline-compose.png'});
 await page.click('#composeCancel').catch(()=>{}); await page.waitForTimeout(300);
 // 恢复网络
 await ctx.setOffline(false); await page.waitForTimeout(2000);
 r.backOnline=await page.evaluate(()=>({onLine:navigator.onLine,barOn:document.getElementById('netBar').classList.contains('on'),toast:document.getElementById('toast').textContent.trim(),posts:document.querySelectorAll('#feedList .post').length}));
 r.errs=errs;
 console.log(JSON.stringify(r));
 await b.close(); srv.close();
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});