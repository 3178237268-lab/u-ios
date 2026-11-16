
const {chromium}=require('playwright-core');
(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage({viewport:{width:420,height:900},deviceScaleFactor:2});
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded'});
  await page.click('#guestBtn').catch(()=>{});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>{document.getElementById('sideDrawer').classList.add('open');});
  await page.waitForTimeout(400);
  const items=await page.evaluate(()=>[...document.querySelectorAll('.side-menu .side-item')].map(b=>b.dataset.side));
  await page.click('[data-side=game]');
  await page.waitForTimeout(600);
  const lb=await page.evaluate(()=>({open:document.getElementById('lobbySheet').classList.contains('open'),cards:[...document.querySelectorAll('#lobbySheet [data-lb]')].map(c=>c.dataset.lb)}));
  await page.click('[data-lb=tear]');
  await page.waitForTimeout(800);
  await page.mouse.move(210,340); await page.mouse.down();
  for(let i=0;i<10;i++){ await page.mouse.move(210+i*8,340+i*15,{steps:2}); }
  await page.mouse.up();
  await page.waitForTimeout(500);
  const ts=await page.evaluate(()=>window.tearState());
  await page.screenshot({path:'D:/deepseek/gouzuoqu/U/uitest/live47.png'});
  console.log(JSON.stringify({items,lb,ts,errs}));
  await browser.close(); process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
