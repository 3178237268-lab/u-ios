const {chromium}=require('playwright-core'); const http=require('http'); const fs=require('fs'); const path=require('path');
const ROOT='D:/deepseek/gouzuoqu/U'; const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'};
const srv=http.createServer((q,s)=>{ const u=decodeURIComponent(q.url.split('?')[0]); const p=path.join(ROOT,u==='/'?'index.html':u.replace(/^\//,''));
  fs.readFile(p,(e,b)=>{ if(e){s.writeHead(404);s.end('no');return;} s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); s.end(b);});});
(async()=>{ await new Promise(r=>srv.listen(18906,'127.0.0.1',r));
 const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
 const ctx=await b.newContext({viewport:{width:420,height:900},deviceScaleFactor:2}); const page=await ctx.newPage();
 const errs=[]; page.on('pageerror',x=>errs.push(String(x).slice(0,160)));
 await page.goto('http://127.0.0.1:18906/index.html',{waitUntil:'load'}); await page.waitForTimeout(800);
 await page.evaluate(()=>localStorage.setItem('u-server','http://127.0.0.1:8787'));
 await page.reload({waitUntil:'load'}); await page.waitForTimeout(1200);
 await page.click('#guestBtn').catch(()=>{}); await page.waitForTimeout(1600);
 const veil = page.locator('.pmedia .pveil-btn').first();
 if (await veil.count()) { await veil.click(); await page.waitForTimeout(500); }
 await page.locator('.pmedia .vgexp').first().click({force:true}); await page.waitForTimeout(1200);
 const r={};
 r.beforeName = await page.evaluate(()=>({viewer:document.getElementById('mediaViewer').classList.contains('open'), hasName:!!document.querySelector('#mvOverlay .mv-name')}));
 await page.click('#mvOverlay .mv-name',{force:true});
 const trail=[];
 for (let i=0;i<10;i++){ await page.waitForTimeout(150);
   trail.push(await page.evaluate(()=>({t:Date.now()%100000, v:document.getElementById('mediaViewer').classList.contains('open'), u:document.getElementById('userSheet').classList.contains('open')})));}
 r.trail=trail.map(x=>(x.v?'V':'-')+(x.u?'U':'-')).join(' ');
 r.final=await page.evaluate(()=>({viewer:document.getElementById('mediaViewer').classList.contains('open'),user:document.getElementById('userSheet').classList.contains('open'),nav:document.getElementById('userNavTitle').textContent.trim()}));
 r.errs=errs;
 console.log(JSON.stringify(r,null,1));
 await b.close(); srv.close();
})();