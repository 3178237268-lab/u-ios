const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('playwright-core');
const ROOT='D:/deepseek/gouzuoqu/U';
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);res.end('nf');return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});res.end(d);});});
(async()=>{
await new Promise(r=>srv.listen(18898,r));
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
const ctx=await b.newContext({viewport:{width:420,height:900},deviceScaleFactor:2});
const page=await ctx.newPage();
const errs=[],bad404=[];
page.on('pageerror',e=>errs.push(String(e).slice(0,120)));
page.on('response',r=>{const u=r.url();if(r.status()===404&&u.includes('/media/'))bad404.push(u.slice(-40));});
await page.goto('http://127.0.0.1:18898/index.html');
await page.evaluate(()=>localStorage.setItem('u-server','http://127.0.0.1:8787'));
await page.reload();await page.waitForTimeout(1200);
await page.click('#guestBtn');await page.waitForTimeout(2200);
for(let i=0;i<25;i++){ if(await page.evaluate(()=>!!document.querySelector('.post[data-id="srv_1138"]')))break; await page.evaluate(()=>window.scrollBy(0,700)); await page.waitForTimeout(600);}
const s=await page.evaluate(()=>{
  const a=document.querySelector('.post[data-id="srv_1138"]');if(a)a.scrollIntoView({block:'center'});
  const v=[...document.querySelectorAll('.post[data-id="srv_1138"] .pmedia video')];
  return {n:v.length,detail:v.map(x=>({p:!!x.getAttribute('poster'),abs:/^http/.test(x.getAttribute('poster')||'')}))};
});
await page.waitForTimeout(2500);
const s2=await page.evaluate(()=>{const v=[...document.querySelectorAll('.post[data-id="srv_1138"] .pmedia video')];return v.map(x=>x.naturalWidth);});
console.log('1178?',JSON.stringify(s));
console.log('naturalWidth',JSON.stringify(s2));
console.log('bad404',bad404.length,bad404.slice(0,3));
console.log('errs',errs.length,errs);
await page.screenshot({path:ROOT+'/uitest/poster55b.png'});
await b.close();srv.close();
})();