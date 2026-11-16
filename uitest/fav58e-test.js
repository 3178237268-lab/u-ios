const {chromium}=require('playwright-core'); const http=require('http'); const fs=require('fs'); const path=require('path');
const ROOT='D:/deepseek/gouzuoqu/U'; const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'};
const srv=http.createServer((q,s)=>{ const u=decodeURIComponent(q.url.split('?')[0]); const p=path.join(ROOT,u==='/'?'index.html':u.replace(/^\//,''));
  fs.readFile(p,(e,b)=>{ if(e){s.writeHead(404);s.end('no');return;} s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); s.end(b);});});
(async()=>{ await new Promise(r=>srv.listen(18907,'127.0.0.1',r));
 const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
 const ctx=await b.newContext({viewport:{width:420,height:900},deviceScaleFactor:2}); const page=await ctx.newPage();
 const errs=[]; page.on('pageerror',x=>errs.push(String(x).slice(0,160)));
 await page.goto('http://127.0.0.1:18907/index.html',{waitUntil:'load'}); await page.waitForTimeout(800);
 await page.evaluate(()=>localStorage.setItem('u-server','http://127.0.0.1:8787'));
 await page.reload({waitUntil:'load'}); await page.waitForTimeout(1200);
 await page.click('#guestBtn').catch(()=>{}); await page.waitForTimeout(1600);
 const veil = page.locator('.pmedia .pveil-btn').first();
 if (await veil.count()) { await veil.click(); await page.waitForTimeout(500); }
 await page.locator('.pmedia .vgexp').first().click({force:true}); await page.waitForTimeout(1100);
 await page.click('#mvOverlay .mv-round[data-mvact="save"]',{force:true}); await page.waitForTimeout(600);
 const r={};
 r.savedId = await page.evaluate(()=>JSON.parse(localStorage.getItem('u-favs')||'[]')[0]);
 await page.click('#mvClose').catch(()=>{});
 await page.waitForTimeout(600);
 await page.evaluate(()=>document.getElementById('sideDrawer').classList.add('open'));
 await page.waitForTimeout(400);
 await page.click('[data-side="favorites"]'); await page.waitForTimeout(1000);
 r.list = await page.evaluate(()=>({open:document.getElementById('sideListSheet').classList.contains('open'),
   n:document.querySelectorAll('#sideListBody .post').length,
   first:(document.querySelector('#sideListBody .post')||{dataset:{}}).dataset.id,
   title:document.getElementById('sideListTitle').textContent,
   badge:(document.getElementById('sideFavCount')||{}).textContent}));
 await page.screenshot({path:ROOT+'/.tmp-test/fav58-list.png'});
 r.errs=errs;
 console.log(JSON.stringify(r,null,1));
 await b.close(); srv.close();
})();