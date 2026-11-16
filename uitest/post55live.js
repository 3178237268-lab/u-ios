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
await page.fill('#authUser','admin123');await page.fill('#authPass','admin123');
await page.click('#authSubmit');await page.waitForTimeout(2500);
await page.click('#composeBtn');await page.waitForTimeout(600);
await page.fill('#composeText','六视频封面回归测试');
await page.setInputFiles('#filePicker',['uitest/tmp1.mp4','uitest/tmp2.mp4','uitest/tmp3.mp4','uitest/tmp4.mp4','uitest/tmp5.mp4','uitest/tmp6.mp4'].map(f=>ROOT+'/'+f));
await page.waitForTimeout(14000);
const cnt=await page.evaluate(()=>document.getElementById('mediaCount').textContent);
console.log('count',cnt);
await page.click('#sensRow');
await page.click('#composePublish');
for(let i=0;i<40;i++){await page.waitForTimeout(2000);const s=await page.evaluate(()=>{const a=[...document.querySelectorAll('.post')].find(x=>x.textContent.includes('六视频封面回归测试'));return a?{cls:a.querySelector('.pmedia')?.className,posters:[...a.querySelectorAll('.pmedia video')].map(v=>v.getAttribute('poster')||''),id:a.dataset.id}:null;});if(s&&s.posters.length){console.log('POST',JSON.stringify(s).slice(0,700));break;}}
await page.evaluate(()=>{const a=[...document.querySelectorAll('.post')].find(x=>x.textContent.includes('六视频封面回归测试'));if(a){a.scrollIntoView({block:'center'});const btn=a.querySelector('.pveil-btn');if(btn)btn.click();}});
await page.waitForTimeout(4000);
const img=await page.evaluate(async()=>{const a=[...document.querySelectorAll('.post')].find(x=>x.textContent.includes('六视频封面回归测试'));const vs=[...a.querySelectorAll('.pmedia video')];const res=[];for(const v of vs){const p=v.getAttribute('poster');const r=await new Promise(rr=>{const i=new Image();i.onload=()=>rr('ok '+i.naturalWidth);i.onerror=()=>rr('ERR');i.src=p;});res.push(r);}return res;});
console.log('IMGCHK',JSON.stringify(img));
await page.locator('.post').filter({hasText:'六视频封面回归测试'}).screenshot({path:ROOT+'/uitest/poster55-live.png'});
console.log('errs',errs.length,errs.slice(0,3));
await b.close();
})();