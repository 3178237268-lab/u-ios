
const { chromium } = require('playwright-core');
const A='http://127.0.0.1:8787'; const W='http://127.0.0.1:8765';
const uname='r161bu'+Math.floor(Math.random()*90000+10000);
(async()=>{
  await fetch(A+'/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:uname,nickname:'测试'+uname,password:'pass123456'})});
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page=await browser.newPage({viewport:{width:412,height:915},hasTouch:true,isMobile:true});
  const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
  await page.goto(W+'/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(800);
  await page.fill('#authUser',uname); await page.fill('#authPass','pass123456');
  await page.evaluate(()=>document.querySelector('#authSubmit').click());
  await page.waitForTimeout(2600);
  await page.evaluate(()=>document.querySelector('.tab[data-tab="search"]').click());
  await page.waitForTimeout(1200);
  await page.fill('#searchInput','u');
  await page.press('#searchInput','Enter');
  await page.waitForTimeout(1500);
  await page.click('#searchInput');
  await page.waitForTimeout(400);
  const dump = ()=>page.evaluate(()=>{
    const v=document.querySelector('#viewSearch'), d=document.querySelector('#searchDrop');
    const txt = e=>Array.from(e.children).map(c=>c.textContent.trim().slice(0,40));
    return { open:v.classList.contains('search-hist-open'), h:Math.round(d.getBoundingClientRect().height),
      hist:txt(document.querySelector('#searchHist')), sug:txt(document.querySelector('#searchSug')),
      input:document.querySelector('#searchInput').value };
  });
  const beforeClear = await dump();
  await page.screenshot({path:'../.tmp-test/r161-before-clear.png'});
  const hasClear = await page.evaluate(()=>!!document.querySelector('#searchHist [data-hclear]'));
  if (hasClear) await page.evaluate(()=>document.querySelector('#searchHist [data-hclear]').click());
  await page.waitForTimeout(600);
  const afterClear = await dump();
  await page.screenshot({path:'../.tmp-test/r161-after-clear.png'});
  console.log(JSON.stringify({beforeClear,afterClear,hasClear,errs},null,1));
  await browser.close();
})();
