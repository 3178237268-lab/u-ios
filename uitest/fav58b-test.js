const {chromium}=require('playwright-core'); const http=require('http'); const fs=require('fs'); const path=require('path');
const ROOT='D:/deepseek/gouzuoqu/U'; const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'};
const srv=http.createServer((q,s)=>{ const u=decodeURIComponent(q.url.split('?')[0]); const p=path.join(ROOT,u==='/'?'index.html':u.replace(/^\//,''));
  fs.readFile(p,(e,b)=>{ if(e){s.writeHead(404);s.end('no');return;} s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); s.end(b);});});
(async()=>{ await new Promise(r=>srv.listen(18904,'127.0.0.1',r));
 const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
 const ctx=await b.newContext({viewport:{width:420,height:900},deviceScaleFactor:2}); const page=await ctx.newPage();
 const errs=[]; page.on('pageerror',x=>errs.push(String(x).slice(0,160)));
 await page.goto('http://127.0.0.1:18904/index.html',{waitUntil:'load'}); await page.waitForTimeout(800);
 await page.evaluate(()=>localStorage.setItem('u-server','http://127.0.0.1:8787'));
 await page.reload({waitUntil:'load'}); await page.waitForTimeout(1200);
 await page.click('#guestBtn').catch(()=>{}); await page.waitForTimeout(1600);
 await page.evaluate(()=>localStorage.removeItem('u-favs'));
 const r={};
 // 18+ 遮罩先点显示
 const veil = page.locator('.pmedia .pveil-btn').first();
 if (await veil.count()) { await veil.click(); await page.waitForTimeout(600); }
 await page.locator('.pmedia .pmedia .vgexp').first().count().catch(()=>0);
 await page.locator('.pmedia .vgexp').first().click({force:true}); await page.waitForTimeout(1300);
 r.viewerOpen = await page.evaluate(()=>document.getElementById('mediaViewer').classList.contains('open'));
 r.saveBefore = await page.evaluate(()=>!!document.querySelector('#mvOverlay .mv-round[data-mvact="save"].on'));
 await page.click('#mvOverlay .mv-round[data-mvact="save"]',{force:true}); await page.waitForTimeout(500);
 r.saveAfter = await page.evaluate(()=>{const el=document.querySelector('#mvOverlay .mv-round[data-mvact="save"]');const cs=getComputedStyle(el);
   return {on:el.classList.contains('on'),color:cs.color,title:el.title,toast:document.getElementById('toast').textContent.trim()};});
 r.favs = await page.evaluate(()=>JSON.parse(localStorage.getItem('u-favs')||'[]').slice(0,3));
 await page.screenshot({path:ROOT+'/.tmp-test/fav58-save.png'});
 await page.click('#mvOverlay .mv-round[data-mvact="save"]',{force:true}); await page.waitForTimeout(400);
 r.saveToggleOff = await page.evaluate(()=>({on:document.querySelector('#mvOverlay .mv-round[data-mvact="save"]').classList.contains('on'),favs:JSON.parse(localStorage.getItem('u-favs')||'[]').length}));
 await page.click('#mvOverlay .mv-round[data-mvact="save"]',{force:true}); await page.waitForTimeout(300);
 r.favId = await page.evaluate(()=>JSON.parse(localStorage.getItem('u-favs')||'[]')[0]||null);
 await page.click('#mvOverlay .mv-ava',{force:true}); await page.waitForTimeout(1600);
 r.afterAuthor = await page.evaluate(()=>({viewerOpen:document.getElementById('mediaViewer').classList.contains('open'),
   bodyClass:document.body.className,
   viewEl:(document.querySelector('.view.active, #viewHome.active, section.view[style*="display: block"]')||{}).id||'',
   userName:(document.querySelector('#userName, .prof-name, .view h2')||{}).textContent||''}));
 await page.screenshot({path:ROOT+'/.tmp-test/fav58-profile.png'});
 r.errs=errs;
 console.log(JSON.stringify(r,null,1));
 await b.close(); srv.close();
})();