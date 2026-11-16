const {chromium}=require('playwright-core');
const ROOT='D:/deepseek/gouzuoqu/U';
(async()=>{
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
const ctx=await b.newContext({viewport:{width:420,height:900},deviceScaleFactor:2});
const page=await ctx.newPage();
const errs=[];page.on('pageerror',e=>errs.push(String(e).slice(0,120)));
await page.goto('http://127.0.0.1:8765/index.html');
await page.evaluate(()=>localStorage.setItem('u-server','http://127.0.0.1:8787'));
await page.reload();await page.waitForTimeout(1500);
await page.click('#guestBtn');await page.waitForTimeout(2500);
await page.waitForTimeout(2000);
await page.evaluate(()=>{const a=document.querySelector('.post[data-id="srv_1169"]');if(a){a.scrollIntoView({block:'center'});const btn=a.querySelector('.pveil-btn');if(btn)btn.click();}});
await page.waitForTimeout(4000);
const info=await page.evaluate(async()=>{
  const a=document.querySelector('.post[data-id="srv_1169"]');
  if(!a)return {err:'no post'};
  const vs=[...a.querySelectorAll('.pmedia video')];
  const res=[];
  for(const v of vs){const p=v.getAttribute('poster')||'';const r=await new Promise(rr=>{if(!p)return rr('noposter');const i=new Image();i.onload=()=>rr('ok'+i.naturalWidth);i.onerror=()=>rr('ERR');i.src=p;});res.push({abs:/^https?:/.test(p),r});}
  return {cls:a.querySelector('.pmedia').className,n:vs.length,res};
});
console.log('LIVE',JSON.stringify(info).slice(0,900));
await page.locator('.post[data-id="srv_1169"]').screenshot({path:ROOT+'/uitest/poster55-live.png'});
console.log('errs',errs.length,errs.slice(0,3));
await b.close();
})();