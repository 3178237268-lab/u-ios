
const {chromium}=require('playwright-core');
(async()=>{
  const r=await fetch('http://127.0.0.1:8787/api/posts?limit=30');
  const j=await r.json();
  const rows=(j.posts||[]).slice(0,12).map(p=>({id:p.id,sens:p.sensitive,priv:p.private,text:(p.text||'').slice(0,12),media:(p.media||[]).map(m=>m.type+':'+(m.poster?'P':'-')+':'+(m.size||0))}));
  console.log(JSON.stringify(rows,null,1).slice(0,3000));
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage({viewport:{width:420,height:900},deviceScaleFactor:2});
  await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded'});
  await page.click('#guestBtn').catch(()=>{});
  await page.waitForTimeout(2500);
  const dom=await page.evaluate(()=>{
    const out=[];
    document.querySelectorAll('#feedList .post').forEach(p=>{
      const med=p.querySelector('.pmedia');
      if(!med) return;
      out.push({id:p.dataset.id,sens:p.dataset.sens||null,cls:med.className,veil:!!med.querySelector('.pveil'),tiles:med.querySelectorAll('.vplayer.vgrid').length,imgs:med.querySelectorAll('img').length});
    });
    return out;
  });
  console.log(JSON.stringify(dom,null,1).slice(0,2500));
  await browser.close(); process.exit(0);
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
