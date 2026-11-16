
const {chromium}=require('playwright-core');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage({viewport:{width:420,height:900},deviceScaleFactor:2,hasTouch:true,isMobile:true});
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded'});
  await sleep(2200);
  await page.click('#guestBtn').catch(()=>{});
  await sleep(2600);
  const find=async()=>page.evaluate(()=>{
    const out=[];
    document.querySelectorAll('.post').forEach(p=>{
      const pm=p.querySelector('.pmedia');
      if(!pm) return;
      out.push({id:p.dataset.id, cls:pm.className, veil:!!pm.querySelector('.pveil'), hideMode:!!pm.querySelector('.pveil.hide-mode'),
        tiles:pm.querySelectorAll('.vplayer.vgrid').length,
        withPoster:[...pm.querySelectorAll('.vplayer.vgrid video')].filter(v=>v.getAttribute('poster')).length});
    });
    return out;
  });
  let list=await find();
  for(let i=0;i<8 && !list.some(x=>x.tiles>=6);i++){ await page.mouse.wheel(0,900); await sleep(900); list=await find(); }
  const grid=list.filter(x=>x.tiles>=6);
  console.log('GRID', JSON.stringify(grid.slice(0,3)));
  // reveal first grid post
  const ok=await page.evaluate(()=>{
    const p=[...document.querySelectorAll('.post')].find(x=>x.querySelectorAll('.pmedia .vplayer.vgrid').length>=6);
    if(!p) return 'nopost';
    const b=p.querySelector('.pveil-btn'); if(!b) return 'nobtn';
    b.click(); return 'clicked';
  });
  await sleep(1200);
  const after=await page.evaluate(()=>{
    const p=[...document.querySelectorAll('.post')].find(x=>x.querySelectorAll('.pmedia .vplayer.vgrid').length>=6);
    if(!p) return null;
    const pm=p.querySelector('.pmedia');
    const vids=[...pm.querySelectorAll('video')];
    return {id:p.dataset.id, cls:pm.className, hideMode:!!pm.querySelector('.pveil.hide-mode'),
      posters:vids.map(v=>(v.getAttribute('poster')||'').slice(-12)), srcs:vids.map(v=>v.currentSrc?'y':'n')};
  });
  console.log('REVEAL', ok, JSON.stringify(after));
  await page.screenshot({path:'uitest/live49.png',fullPage:false});
  await sleep(300);
  console.log('ERRS', errs.slice(0,2));
  await browser.close();
  process.exit(0);
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
