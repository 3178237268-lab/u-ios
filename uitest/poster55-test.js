const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('playwright-core');
const ROOT='D:/deepseek/gouzuoqu/U';
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);res.end('nf');return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});res.end(d);});});
(async()=>{
await new Promise(r=>srv.listen(18897,r));
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
const ctx=await b.newContext({viewport:{width:420,height:900},deviceScaleFactor:2});
const page=await ctx.newPage();
const errs=[],bad404=[];
page.on('pageerror',e=>errs.push(String(e).slice(0,160)));
page.on('response',r=>{const u=r.url();if(r.status()===404&&u.includes('/media/'))bad404.push(u.slice(-60));});
await page.goto('http://127.0.0.1:18897/index.html');
await page.evaluate(()=>localStorage.setItem('u-server','http://127.0.0.1:8787'));
await page.reload();await page.waitForTimeout(1500);
await page.click('#guestBtn');await page.waitForTimeout(2500);
// scroll feed until srv_1138
let found=false;
for(let i=0;i<25;i++){
  found=await page.evaluate(()=>!!document.querySelector('.post[data-id="srv_1138"]'));
  if(found)break;
  await page.evaluate(()=>{const l=document.getElementById('feedList')||document.scrollingElement;window.scrollBy(0,700);if(l&&l!==document.scrollingElement)l.scrollTop+=700;});
  await page.waitForTimeout(700);
}
console.log('found1138',found);
if(found){
  await page.evaluate(()=>{const a=document.querySelector('.post[data-id="srv_1138"]');a.scrollIntoView({block:'center'});const b=a.querySelector('.pveil-btn');if(b)b.click();});
  await page.waitForTimeout(3000);
}
const info=await page.evaluate(()=>{
  const out=[];
  document.querySelectorAll('.post .pmedia video').forEach(v=>{if(v.dataset.mid)out.push({mid:v.dataset.mid,poster:(v.getAttribute('poster')||'').slice(0,70),nw:v.naturalWidth});});
  return {posts:[...document.querySelectorAll('.post[data-id^="srv_"]')].map(a=>a.dataset.id).slice(0,12),vids:out};
});
console.log('VIDS',JSON.stringify(info.vids.filter(v=>v.poster)));
console.log('NOPOSTER',info.vids.filter(v=>!v.poster).length,'bad404',bad404.length,bad404.slice(0,3));
console.log('errs',errs.length,errs.slice(0,3));
await page.screenshot({path:ROOT+'/uitest/poster55.png'});
await b.close();srv.close();
})();