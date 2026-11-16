
const {chromium}=require('playwright-core');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage({viewport:{width:420,height:900},deviceScaleFactor:2,hasTouch:true,isMobile:true});
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded'});
  await sleep(2400);
  await page.click('#guestBtn').catch(()=>{});
  await sleep(2600);
  const info=await page.evaluate(()=>({
    ver:(document.documentElement.innerHTML.match(/APP_VERSION\s*=\s*'([^']+)'/)||[])[1]||'inline',
    scrubCss:[...document.styleSheets].length,
    scrubs:document.querySelectorAll('.mv-overlay .mv-scrub').length,
    seeded:localStorage.getItem('u-notice-seeded'),
    appver:localStorage.getItem('u-app-ver'),
    notifVer:(JSON.parse(localStorage.getItem('u-notifs')||'[]')||[]).filter(n=>String(n.version||'').indexOf('1.75')>=0).length
  }));
  console.log('LIVE',JSON.stringify(info));
  // open one video to confirm scrub inside viewer on deployed build
  for(let i=0;i<8;i++){ const n=await page.evaluate(()=>document.querySelectorAll('.pmedia .vgexp').length); if(n) break; await page.mouse.wheel(0,800); await sleep(700);}
  const ok=await page.evaluate(()=>{const b=document.querySelector('.pmedia .vgexp'); if(!b) return 'none'; b.click(); return 'clicked';});
  await sleep(2200);
  const v=await page.evaluate(()=>{const box=document.querySelector('#mvOverlay'); if(!box) return null; const b=box.querySelector('.mv-prog b'); return {scrub:!!box.querySelector('.mv-scrub'),buf:b?b.style.width:'',pe:box.querySelector('.mv-scrub')?getComputedStyle(box.querySelector('.mv-scrub')).pointerEvents:''};});
  console.log('VIEWER',ok,JSON.stringify(v));
  console.log('ERRS',errs.slice(0,2));
  await browser.close();process.exit(0);
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
