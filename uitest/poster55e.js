const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('playwright-core');
const ROOT='D:/deepseek/gouzuoqu/U';
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css'};
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);res.end('nf');return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});res.end(d);});});
(async()=>{
await new Promise(r=>srv.listen(18902,r));
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox','--disable-gpu']});
const ctx=await b.newContext({viewport:{width:420,height:900},deviceScaleFactor:2});
const page=await ctx.newPage();
await page.goto('http://127.0.0.1:18902/index.html');
await page.evaluate(()=>localStorage.setItem('u-server','http://127.0.0.1:8787'));
await page.reload();await page.waitForTimeout(1200);
await page.click('#guestBtn');await page.waitForTimeout(2200);
for(let i=0;i<25;i++){ if(await page.evaluate(()=>!!document.querySelector('.post[data-id="srv_1138"]')))break; await page.evaluate(()=>window.scrollBy(0,700)); await page.waitForTimeout(600);}
await page.evaluate(()=>{const a=document.querySelector('.post[data-id="srv_1138"]');a.scrollIntoView({block:'center'});const btn=a.querySelector('.pveil-btn');if(btn)btn.click();});
await page.waitForTimeout(1500);
const info=await page.evaluate(async()=>{
  const a=document.querySelector('.post[data-id="srv_1138"]');
  const v=a.querySelector('.pmedia video');
  const cs=getComputedStyle(v);
  const rect=v.getBoundingClientRect();
  const img=new Image();
  const res=await new Promise(r=>{img.onload=()=>r('ok '+img.naturalWidth+'x'+img.naturalHeight);img.onerror=e=>r('err');img.src=v.getAttribute('poster');});
  const fetchRes=await fetch(v.getAttribute('poster')).then(r=>'fetch '+r.status).catch(e=>'fetch fail '+e.message);
  return {poster:v.getAttribute('poster'),videoPosterProp:v.poster,opacity:cs.opacity,visibility:cs.visibility,display:cs.display,objectFit:cs.objectFit,filter:cs.filter,bg:cs.backgroundColor,rect:[rect.width|0,rect.height|0],imgLoad:res,fetchRes,mediaCls:a.querySelector('.pmedia').className,vclass:v.className,parentCls:v.parentElement.className};
});
console.log(JSON.stringify(info));
await b.close();srv.close();
})();