
const { chromium } = require('playwright-core');
const A='http://127.0.0.1:8787'; const W='http://127.0.0.1:8765';
const uname='r161du'+Math.floor(Math.random()*90000+10000);
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
  const hot = await page.evaluate(()=>Array.from(document.querySelectorAll('#hotRank .hot-item')).slice(0,4).map(it=>{
    const no=it.querySelector('.hot-no'); const meta=it.querySelector('.hot-meta span');
    return { no:no?no.textContent.trim():'', bg:no?getComputedStyle(no).backgroundColor:'', who:meta?meta.textContent.trim():'' };
  }));
  await page.screenshot({path:'../.tmp-test/r161-hot2.png'});

  await page.evaluate(()=>localStorage.removeItem('u-search-hist'));
  await page.click('#searchInput');
  await page.type('#searchInput','zzqq',{delay:30});
  let blankMax=0;
  for (let i=0;i<7;i++){
    await page.waitForTimeout(80);
    const s=await page.evaluate(()=>{const v=document.querySelector('#viewSearch'),d=document.querySelector('#searchDrop');
      return {open:v.classList.contains('search-hist-open'),h:Math.round(d.getBoundingClientRect().height),sug:document.querySelector('#searchSug').children.length,hist:document.querySelector('#searchHist').children.length};});
    if (s.sug===0 && s.hist===0 && s.h>blankMax) blankMax=s.h;
  }
  await page.fill('#searchInput','u'); await page.press('#searchInput','Enter');
  await page.waitForTimeout(1600);
  const users = await page.evaluate(()=>Array.from(document.querySelectorAll('#searchResults .search-user')).map(r=>({
    name:(r.querySelector('b')||{}).textContent||'', handle:(r.querySelector('.search-user-main span')||{}).textContent||''})));
  const phandles = await page.evaluate(()=>Array.from(document.querySelectorAll('#searchResults .post .phandle')).slice(0,3).map(e=>e.textContent));
  const uo = (await page.evaluate(()=>document.querySelector('#searchResults').textContent)).split('u_official').length-1;
  await page.screenshot({path:'../.tmp-test/r161-search2.png'});

  await page.fill('#searchInput','');
  await page.click('#searchInput');
  await page.waitForTimeout(500);
  const pre = await page.evaluate(()=>{const v=document.querySelector('#viewSearch'),d=document.querySelector('#searchDrop');
    return {open:v.classList.contains('search-hist-open'),h:Math.round(d.getBoundingClientRect().height),hist:document.querySelector('#searchHist').children.length};});
  const hasClear = await page.evaluate(()=>!!document.querySelector('#searchHist [data-hclear]'));
  if (hasClear) await page.evaluate(()=>document.querySelector('#searchHist [data-hclear]').click());
  await page.waitForTimeout(500);
  const post = await page.evaluate(()=>{const v=document.querySelector('#viewSearch'),d=document.querySelector('#searchDrop');
    return {open:v.classList.contains('search-hist-open'),h:Math.round(d.getBoundingClientRect().height),hist:document.querySelector('#searchHist').children.length};});
  await page.screenshot({path:'../.tmp-test/r161-clear2.png'});
  console.log(JSON.stringify({uname,hot,blankMax,officialRows:users.filter(u=>/官方/.test(u.name)),usersCount:users.length,phandles,uoMentions:uo,pre,hasClear,post,errs},null,1));
  await browser.close();
})();
