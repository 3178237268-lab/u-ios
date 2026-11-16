const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('playwright-core');
const ROOT='D:/deepseek/gouzuoqu/U';
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css'};
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);res.end('nf');return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});res.end(d);});});
(async()=>{
await new Promise(r=>srv.listen(18901,r));
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox','--disable-gpu']});
const ctx=await b.newContext({viewport:{width:420,height:900},deviceScaleFactor:2});
const page=await ctx.newPage();
const logs=[];page.on('console',m=>logs.push(m.text().slice(0,100)));
await page.goto('http://127.0.0.1:18901/index.html');
await page.evaluate(()=>localStorage.setItem('u-server','http://127.0.0.1:8787'));
await page.reload();await page.waitForTimeout(1200);
await page.click('#guestBtn');await page.waitForTimeout(2200);
for(let i=0;i<25;i++){ if(await page.evaluate(()=>!!document.querySelector('.post[data-id="srv_1138"]')))break; await page.evaluate(()=>window.scrollBy(0,700)); await page.waitForTimeout(600);}
await page.evaluate(()=>{const a=document.querySelector('.post[data-id="srv_1138"]');a.scrollIntoView({block:'center'});const btn=a.querySelector('.pveil-btn');if(btn)btn.click();});
await page.waitForTimeout(3500);
const st=await page.evaluate(()=>{const a=document.querySelector('.post[data-id="srv_1138"]');const v=[...a.querySelectorAll('.pmedia video')];return {cls:a.querySelector('.pmedia').className,n:v.length,posters:v.map(x=>x.getAttribute('poster')||''),complete:v.map(x=>x.complete)};});
console.log(JSON.stringify(st));
await page.locator('.post[data-id="srv_1138"]').screenshot({path:ROOT+'/uitest/poster55-card.png'});
await b.close();srv.close();
})();