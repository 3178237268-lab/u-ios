
const {chromium}=require('playwright-core');
(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage({viewport:{width:420,height:900},deviceScaleFactor:2});
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded'});
  await page.click('#guestBtn').catch(()=>{});
  await page.waitForTimeout(1600);
  const v=await page.$('.pveil-btn'); if(v){await v.click().catch(()=>{});await page.waitForTimeout(500);}
  await page.click('.pmedia .vgexp');
  await page.waitForTimeout(1500);
  const T=(n,ok,x)=>{console.log((ok?'PASS ':'FAIL ')+n+(x?' :: '+x:''));};
  const st=async()=>page.evaluate(()=>{const v=document.querySelector('#mvContent video');return {paused:v.paused,rate:v.playbackRate,muted:v.muted,count:document.getElementById('mvCount').textContent,time:document.querySelector('.mv-remain').textContent};});
  const s0=await st();
  T('video playing', !s0.paused, JSON.stringify(s0));
  await page.click('.mv-cbtn[data-mvact=playpause]');
  await page.waitForTimeout(350);
  const s1=await st();
  T('pause works', s1.paused, JSON.stringify(s1));
  await page.click('.mv-cbtn[data-mvact=playpause]');
  await page.waitForTimeout(300);
  T('resume works', !(await st()).paused);
  await page.click('.mv-cbtn[data-mvact=speed]');
  await page.waitForTimeout(300);
  const s2=await st();
  T('speed 1.25', Math.abs(s2.rate-1.25)<0.01, JSON.stringify(s2));
  T('speed label', (await page.textContent('.mv-speed'))==='1.25x', await page.textContent('.mv-speed'));
  await page.click('.mv-cbtn[data-mvact=mute]');
  await page.waitForTimeout(300);
  T('mute works', (await st()).muted, '');
  await page.click('.mv-cbtn[data-mvact=mute]');
  await page.waitForTimeout(250);
  await page.click('.mv-cbtn[data-mvact=next]');
  await page.waitForTimeout(1300);
  const s3=await st();
  T('next switches', s3.count!==s0.count, s0.count+' -> '+s3.count);
  const sizes=await page.evaluate(()=>{
    const g=(s)=>{const e=document.querySelector(s);const r=e.getBoundingClientRect();const sv=e.querySelector('svg');return {w:Math.round(r.width),h:Math.round(r.height),svg:sv?Math.round(sv.getBoundingClientRect().width):0,bg:getComputedStyle(e).backgroundColor};};
    return {pause:g('.mv-cbtn[data-mvact=playpause]'),pill:g('.mv-pill'),round:g('.mv-round'),remain:getComputedStyle(document.querySelector('.mv-remain')).fontSize};
  });
  T('icon enlarged', sizes.pause.svg>=22, JSON.stringify(sizes));
  T('control bg transparent', sizes.pause.bg==='rgba(0, 0, 0, 0)', sizes.pause.bg);
  await page.screenshot({path:'D:/deepseek/gouzuoqu/U/uitest/mv48-full.png'});
  T('no pageerror', errs.length===0, errs.join(' | '));
  await browser.close(); process.exit(0);
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
