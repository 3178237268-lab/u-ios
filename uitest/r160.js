
const { chromium } = require('playwright-core');
const A='http://127.0.0.1:8787'; const W='http://127.0.0.1:8765';
const uname='r160u'+Math.floor(Math.random()*90000+10000);
(async()=>{
  await fetch(A+'/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:uname,nickname:'推特'+uname,password:'pass123456'})});
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page=await browser.newPage({viewport:{width:412,height:915},hasTouch:true,isMobile:true});
  const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
  const fixture={id:'666',url:'https://x.com/seaside/status/666',text:'测试',createdAt:'',author:{name:'海边的人',handle:'seaside',avatar:''},
    groups:[{index:1,total:1,poster:'',duration:12,width:1280,height:720,options:[{label:'720p',size:'1280×720',bytes:300000,mime:'video/mp4',url:'https://video.twimg.com/v/z/1280x720.mp4'}]}]};
  await page.route('**/api/twitter/parse', r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixture)}));
  await page.addInitScript(()=>{
    window.__calls=[]; const st={};
    window.UHost={
      downloadMedia:function(url,name){ window.__calls.push({fn:'downloadMedia'}); const id='t1';
        st[id]={state:'running',got:100000,total:300000};
        setTimeout(()=>{st[id]={state:'done',got:300000,total:300000,uri:'content://x'};},600); return id; },
      downloadState:function(id){ return JSON.stringify(st[id]||{}); },
      openDownloaded:function(name){ window.__calls.push({fn:'play',name}); return true; },
      openDownloadFolder:function(name){ window.__calls.push({fn:'folder',name}); return JSON.stringify({ok:true,path:'/storage/emulated/0/Movies/U'}); },
      deleteDownloaded:function(){ return JSON.stringify({ok:true}); }
    };
  });
  await page.goto(W+'/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(900);
  await page.fill('#authUser',uname); await page.fill('#authPass','pass123456');
  await page.evaluate(()=>document.querySelector('#authSubmit').click());
  await page.waitForTimeout(2400);
  await page.evaluate(()=>{document.querySelector('#sideDrawer').classList.add('open'); document.querySelector('[data-side="twitter"]').click();});
  await page.waitForTimeout(400);
  await page.fill('#twUrl','https://x.com/seaside/status/666');
  await page.evaluate(()=>document.querySelector('#twParse').click());
  await page.waitForTimeout(1000);
  await page.evaluate(()=>document.querySelector('#twResult [data-twget]').click());
  await page.waitForTimeout(1500);
  await page.evaluate(()=>document.querySelector('#twDlBtn').click());
  await page.waitForTimeout(400);
  const btns=await page.evaluate(()=>Array.from(document.querySelectorAll('#twDlBody .tw-dl-act button')).map(b=>b.textContent));
  await page.evaluate(()=>document.querySelector('#twDlBody [data-twopen]').click());
  await page.waitForTimeout(400);
  const toast1=await page.evaluate(()=>{const t=document.querySelector('#toast'); return {on:t.classList.contains('on'), text:t.textContent};});
  await page.screenshot({path:'../.tmp-test/r160-folder.png'});
  await page.evaluate(()=>document.querySelector('#twDlBody [data-twplay]').click());
  await page.waitForTimeout(300);
  const calls=await page.evaluate(()=>window.__calls);
  console.log(JSON.stringify({uname,btns,toast1,calls,errs},null,1));
  await browser.close();
})();
