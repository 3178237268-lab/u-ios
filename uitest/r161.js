
const { chromium } = require('playwright-core');
const A='http://127.0.0.1:8787'; const W='http://127.0.0.1:8765';
const uname='r161u'+Math.floor(Math.random()*90000+10000);
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

  // 进入搜索页
  await page.evaluate(()=>document.querySelector('.tab[data-tab="search"]').click());
  await page.waitForTimeout(1500);

  // 热度榜前三名底色
  const hot = await page.evaluate(()=>Array.from(document.querySelectorAll('#hotRank .hot-item')).slice(0,6).map(it=>{
    const no = it.querySelector('.hot-no');
    return { txt: no ? no.textContent.trim() : '', bg: no ? getComputedStyle(no).backgroundColor : '', cls: it.className };
  }));

  // 图四-1：历史为空时输入字符
  await page.evaluate(()=>localStorage.removeItem('u-search-hist'));
  await page.click('#searchInput');
  await page.type('#searchInput','zzqq', {delay:40});
  const samples=[];
  for (const t of [60,150,300,600,1000]) {
    await page.waitForTimeout(t===60?60:150);
    samples.push(await page.evaluate(()=>{
      const v=document.querySelector('#viewSearch'); const d=document.querySelector('#searchDrop');
      return { open: v.classList.contains('search-hist-open'), h: Math.round(d.getBoundingClientRect().height),
               hist: document.querySelector('#searchHist').children.length, sug: document.querySelector('#searchSug').children.length };
    }));
  }

  // 图一/图二：搜索 u
  await page.fill('#searchInput','');
  await page.fill('#searchInput','u');
  await page.press('#searchInput','Enter');
  await page.waitForTimeout(1800);
  const users = await page.evaluate(()=>Array.from(document.querySelectorAll('#searchResults .search-user')).map(r=>({
    name: (r.querySelector('b')||{}).textContent||'', handle: (r.querySelector('.search-user-main span')||{}).textContent||''
  })));
  const officialRows = users.filter(u=>/官方/.test(u.name));
  const phandles = await page.evaluate(()=>Array.from(document.querySelectorAll('#searchResults .post .phandle')).slice(0,4).map(e=>e.textContent));
  const uoCount = (await page.evaluate(()=>document.querySelector('#searchResults').textContent)).split('u_official').length-1;

  // 图四-2：清空搜索记录
  await page.click('#searchInput');
  await page.waitForTimeout(400);
  const beforeClear = await page.evaluate(()=>{const v=document.querySelector('#viewSearch'); const d=document.querySelector('#searchDrop');
    return { open: v.classList.contains('search-hist-open'), h: Math.round(d.getBoundingClientRect().height), hist: document.querySelector('#searchHist').children.length };});
  const hasClear = await page.evaluate(()=>!!document.querySelector('#searchHist [data-hclear]'));
  if (hasClear) { await page.evaluate(()=>document.querySelector('#searchHist [data-hclear]').click()); }
  await page.waitForTimeout(500);
  const afterClear = await page.evaluate(()=>{const v=document.querySelector('#viewSearch'); const d=document.querySelector('#searchDrop');
    return { open: v.classList.contains('search-hist-open'), h: Math.round(d.getBoundingClientRect().height), hist: document.querySelector('#searchHist').children.length };});
  await page.screenshot({path:'../.tmp-test/r161-search.png'});
  console.log(JSON.stringify({uname,hot,emptyTypeSamples:samples,users,officialRows,phandles,uoOfficialMentions:uoCount,beforeClear,hasClear,afterClear,errs},null,1));
  await browser.close();
})();
