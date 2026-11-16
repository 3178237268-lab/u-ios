const {chromium}=require('playwright-core'); const http=require('http'); const fs=require('fs'); const path=require('path');
const ROOT='D:/deepseek/gouzuoqu/U'; const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'};
const srv=http.createServer((q,s)=>{ const u=decodeURIComponent(q.url.split('?')[0]); const p=path.join(ROOT,u==='/'?'index.html':u.replace(/^\//,''));
  fs.readFile(p,(e,b)=>{ if(e){s.writeHead(404);s.end('no');return;} s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); s.end(b);});});
(async()=>{ await new Promise(r=>srv.listen(18905,'127.0.0.1',r));
 const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
 const ctx=await b.newContext({viewport:{width:420,height:900},deviceScaleFactor:2}); const page=await ctx.newPage();
 const errs=[]; page.on('pageerror',x=>errs.push(String(x).slice(0,160)));
 await page.goto('http://127.0.0.1:18905/index.html',{waitUntil:'load'}); await page.waitForTimeout(800);
 await page.evaluate(()=>localStorage.setItem('u-server','http://127.0.0.1:8787'));
 await page.reload({waitUntil:'load'}); await page.waitForTimeout(1200);
 await page.click('#guestBtn').catch(()=>{}); await page.waitForTimeout(1600);
 const veil = page.locator('.pmedia .pveil-btn').first();
 if (await veil.count()) { await veil.click(); await page.waitForTimeout(500); }
 await page.locator('.pmedia .vgexp').first().click({force:true}); await page.waitForTimeout(1200);
 const r={};
 r.authorName = await page.evaluate(()=>document.querySelector('#mvOverlay .mv-name').textContent);
 await page.click('#mvOverlay .mv-ava',{force:true}); await page.waitForTimeout(1500);
 r.after = await page.evaluate(()=>{const sh=document.getElementById('userSheet');
   return {viewerOpen:document.getElementById('mediaViewer').classList.contains('open'), userSheetOpen:sh.classList.contains('open'),
     navTitle:document.getElementById('userNavTitle').textContent.trim(),
     name:document.getElementById('userName').textContent.trim(),
     handle:document.getElementById('userHandle').textContent.trim(),
     followVisible:getComputedStyle(document.getElementById('userFollowBtn')).display};});
 await page.screenshot({path:ROOT+'/.tmp-test/fav58-profile.png'});
 // 点昵称也要能进（再开一次查看器点 .mv-name）
 await page.evaluate(()=>document.getElementById('userSheet').classList.remove('open'));
 await page.locator('.pmedia .vgexp').first().click({force:true}); await page.waitForTimeout(1000);
 await page.click('#mvOverlay .mv-name',{force:true}); await page.waitForTimeout(1200);
 r.byName = await page.evaluate(()=>({userSheetOpen:document.getElementById('userSheet').classList.contains('open'),
   viewerOpen:document.getElementById('mediaViewer').classList.contains('open')}));
 r.errs=errs;
 console.log(JSON.stringify(r,null,1));
 await b.close(); srv.close();
})();