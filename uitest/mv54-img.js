const {chromium}=require('playwright-core');
(async()=>{ const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu']});
 const page=await b.newPage({viewport:{width:420,height:900}}); const errs=[]; page.on('pageerror',x=>errs.push(String(x).slice(0,120)));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'load'}); await page.waitForTimeout(1300); await page.click('#guestBtn').catch(()=>{}); await page.waitForTimeout(1500);
 const r=await page.evaluate(()=>{ const img=[...document.querySelectorAll('#feedList .pmedia img')][0]; if(!img) return 'noimg'; img.click(); return 'ok'; });
 await page.waitForTimeout(1200);
 const m=await page.evaluate(()=>{const mv=document.getElementById('mediaViewer'); const navs=[...document.querySelectorAll('.mv-nav')]; return {open:mv.classList.contains('open'),vswipe:mv.classList.contains('vswipe'),nav:navs.map(n=>getComputedStyle(n).display),dis:navs.map(n=>n.disabled)};});
 console.log(JSON.stringify({r,m,errs})); await b.close(); })().catch(e=>{console.log('FATAL',e.message);process.exit(1);});