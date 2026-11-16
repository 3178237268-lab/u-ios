
const { chromium } = require('playwright-core');
const SITE='http://127.0.0.1:8765/index.html', API='http://127.0.0.1:8787';
(async()=>{
  const out={};
  const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu']});
  const p=await b.newPage({viewport:{width:420,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,120)));
  await p.goto(SITE,{waitUntil:'load'});
  await p.evaluate(s=>localStorage.setItem('u-server',s),API);
  await p.reload({waitUntil:'load'}); await p.waitForTimeout(900);
  await p.fill('#authUser','viewer57'); await p.fill('#authPass','viewer123'); await p.click('#authSubmit'); await p.waitForTimeout(3500);
  out.feed0=await p.locator('#feedList .post').count();
  for(let i=0;i<6;i++){ await p.mouse.wheel(0,3000); await p.waitForTimeout(900); }
  out.feedAfterScroll=await p.locator('#feedList .post').count();
  out.localPosts=await p.evaluate(()=>{ try { const raw=localStorage.getItem('u-posts'); return raw? JSON.parse(raw).length : -1; } catch(e){ return 'ERR'; } });
  /* 直接找 1166 */
  const r=await p.evaluate(async()=>{
    const all=[]; for(const page of [1,2,3,4]){ const d=await (await fetch('http://127.0.0.1:8787/api/posts?page='+page+'&limit=50')).json(); all.push(...(d.items||d.posts||[])); }
    const img=all.find(x=>(x.media||[]).some(m=>/^image\//.test(m.mime)));
    return img? {id:img.id, media:img.media.map(m=>({mime:m.mime,poster:!!m.poster,ratio:m.ratio}))} : {none:true, n:all.length};
  });
  out.imgPost=r;
  if(r.id){
    const vis=await p.evaluate(async(id)=>{ const el=document.querySelector('.post[data-id="srv_'+id+'"]'); if(!el) return 'not-in-feed'; const im=el.querySelector('.pmedia img'); if(!im) return 'no-img'; return await new Promise(res=>{ if(im.complete) return res(im.naturalWidth+'x'+im.naturalHeight+' '+im.src.slice(0,50)); im.onload=()=>res(im.naturalWidth+'x'+im.naturalHeight); im.onerror=()=>res('ERR'); setTimeout(()=>res('TIMEOUT'),8000); }); }, r.id);
    out.imgLoad=vis;
  }
  out.errs=errs;
  console.log(JSON.stringify(out,null,1).slice(0,2500));
  await b.close();
})();
