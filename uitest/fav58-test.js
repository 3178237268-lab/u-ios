const {chromium}=require('playwright-core'); const http=require('http'); const fs=require('fs'); const path=require('path');
const ROOT='D:/deepseek/gouzuoqu/U'; const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'};
const srv=http.createServer((q,s)=>{ const u=decodeURIComponent(q.url.split('?')[0]); const p=path.join(ROOT,u==='/'?'index.html':u.replace(/^\//,''));
  fs.readFile(p,(e,b)=>{ if(e){s.writeHead(404);s.end('no');return;} s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); s.end(b);});});
(async()=>{ await new Promise(r=>srv.listen(18903,'127.0.0.1',r));
 const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
 const ctx=await b.newContext({viewport:{width:420,height:900},deviceScaleFactor:2}); const page=await ctx.newPage();
 const errs=[]; page.on('pageerror',x=>errs.push(String(x).slice(0,160)));
 await page.goto('http://127.0.0.1:18903/index.html',{waitUntil:'load'}); await page.waitForTimeout(800);
 await page.evaluate(()=>localStorage.setItem('u-server','http://127.0.0.1:8787'));
 await page.reload({waitUntil:'load'}); await page.waitForTimeout(1200);
 await page.click('#guestBtn').catch(()=>{}); await page.waitForTimeout(1600);
 const r={};
 // 打开一个视频查看器
 const grid = page.locator('.pmedia .vgexp, .pmedia .vstage').first();
 await grid.click(); await page.waitForTimeout(1200);
 r.viewerOpen = await page.evaluate(()=>document.getElementById('mediaViewer').classList.contains('open'));
 r.saveBefore = await page.evaluate(()=>!!document.querySelector('#mvOverlay .mv-round[data-mvact="save"].on'));
 await page.click('#mvOverlay .mv-round[data-mvact="save"]'); await page.waitForTimeout(500);
 r.saveAfter = await page.evaluate(()=>{const el=document.querySelector('#mvOverlay .mv-round[data-mvact="save"]');const cs=getComputedStyle(el);
   return {on:el.classList.contains('on'),color:cs.color,title:el.title,toast:document.getElementById('toast').textContent.trim()};});
 r.favs = await page.evaluate(()=>JSON.parse(localStorage.getItem('u-favs')||'[]').slice(0,3));
 await page.screenshot({path:ROOT+'/.tmp-test/fav58-save.png'});
 // 再点一次取消
 await page.click('#mvOverlay .mv-round[data-mvact="save"]'); await page.waitForTimeout(400);
 r.saveToggleOff = await page.evaluate(()=>({on:document.querySelector('#mvOverlay .mv-round[data-mvact="save"]').classList.contains('on'),favs:JSON.parse(localStorage.getItem('u-favs')||'[]').length}));
 // 再收藏回来，然后点作者头像
 await page.click('#mvOverlay .mv-round[data-mvact="save"]'); await page.waitForTimeout(300);
 r.favId = await page.evaluate(()=>JSON.parse(localStorage.getItem('u-favs')||'[]')[0]||null);
 await page.click('#mvOverlay .mv-ava'); await page.waitForTimeout(1500);
 r.afterAuthor = await page.evaluate(()=>{const vis=[...document.querySelectorAll('section.view')].filter(s=>getComputedStyle(s).display!=='none').map(s=>s.id);
   return {viewerOpen:document.getElementById('mediaViewer').classList.contains('open'),views:vis,
     title:(document.querySelector('.view-on h2, #viewUser h2, .notes-head h2')||{}).textContent||'',
     hash:location.hash};});
 await page.screenshot({path:ROOT+'/.tmp-test/fav58-profile.png'});
 // 收藏列表里能找到这条
 await page.evaluate(()=>{document.getElementById('sideDrawer').classList.add('open');});
 await page.waitForTimeout(400);
 await page.click('[data-side="favorites"]'); await page.waitForTimeout(900);
 r.sideList = await page.evaluate(()=>({open:document.getElementById('sideListSheet').classList.contains('open'),
   count:document.querySelectorAll('#sideListBody .post').length,
   firstId:(document.querySelector('#sideListBody .post')||{dataset:{}}).dataset.id,
   title:document.getElementById('sideListTitle').textContent}));
 await page.screenshot({path:ROOT+'/.tmp-test/fav58-list.png'});
 r.errs=errs;
 console.log(JSON.stringify(r,null,1));
 await b.close(); srv.close();
})();