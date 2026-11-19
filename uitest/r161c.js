
const { chromium } = require('playwright-core');
const A='http://127.0.0.1:8787'; const W='http://127.0.0.1:8765';
const uname='r161cu'+Math.floor(Math.random()*90000+10000);
(async()=>{
  await fetch(A+'/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:uname,nickname:'测试'+uname,password:'pass123456'})});
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page=await browser.newPage({viewport:{width:412,height:915},hasTouch:true,isMobile:true});
  const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
  await page.goto(W+'/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(800);
  await page.fill('#authUser',uname); await page.fill('#authPass','pass123456');
  await page.evaluate(()=>document.querySelector('#authSubmit').click());
  await page.waitForTimeout(3000);
  await page.evaluate(()=>document.querySelector('.tab[data-tab="search"]').click());
  await page.waitForTimeout(1500);

  const hot = await page.evaluate(()=>Array.from(document.querySelectorAll('#hotRank .hot-item')).slice(0,5).map(it=>{
    const no=it.querySelector('.hot-no');
    return { n:no?no.textContent.trim():'', bg:no?getComputedStyle(no).backgroundColor:'', cls:it.className };
  }));
  await page.screenshot({path:'../.tmp-test/r161-hot.png'});

  // 输入窗口采样（历史先清空）
  await page.evaluate(()=>localStorage.removeItem('u-search-hist'));
  const samples=[];
  await page.click('#searchInput');
  await page.type('#searchInput','zzqq', {delay:30});
  for (let i=0;i<8;i++){
    await page.waitForTimeout(80);
    samples.push(await page.evaluate(()=>{
      const v=document.querySelector('#viewSearch'), d=document.querySelector('#searchDrop');
      return { open:v.classList.contains('search-hist-open'), h:Math.round(d.getBoundingClientRect().height),
        hist:document.querySelector('#searchHist').children.length, sug:document.querySelector('#searchSug').children.length };
    }));
  }

  // 清空历史：输入框保持为空（用户真实场景）
  await page.fill('#searchInput','u'); await page.press('#searchInput','Enter');
  await page.waitForTimeout(1200);
  await page.fill('#searchInput','');
  await page.click('#searchInput');
  await page.waitForTimeout(500);
  const pre = await page.evaluate(()=>{const v=document.querySelector('#viewSearch'),d=document.querySelector('#searchDrop');
    return { open:v.classList.contains('search-hist-open'), h:Math.round(d.getBoundingClientRect().height), hist:document.querySelector('#searchHist').children.length, sug:document.querySelector('#searchSug').children.length };});
  const hasClear = await page.evaluate(()=>!!document.querySelector('#searchHist [data-hclear]'));
  if (hasClear) await page.evaluate(()=>document.querySelector('#searchHist [data-hclear]').click());
  await page.waitForTimeout(500);
  const post = await page.evaluate(()=>{const v=document.querySelector('#viewSearch'),d=document.querySelector('#searchDrop');
    return { open:v.classList.contains('search-hist-open'), h:Math.round(d.getBoundingClientRect().height), hist:document.querySelector('#searchHist').children.length, sug:document.querySelector('#searchSug').children.length };});
  await page.screenshot({path:'../.tmp-test/r161-clear.png'});
  console.log(JSON.stringify({uname,hot,typingSamples:samples,pre,hasClear,post,errs},null,1));
  await browser.close();
})();
