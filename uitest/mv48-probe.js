
const {chromium}=require('playwright-core');
(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage({viewport:{width:420,height:900},deviceScaleFactor:2});
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded'});
  await page.click('#guestBtn').catch(()=>{});
  await page.waitForTimeout(1800);
  // 显示 18+ 内容
  const veil = await page.$('.pveil-btn');
  if (veil) { await veil.click().catch(()=>{}); await page.waitForTimeout(600); }
  // 找第一个多视频格子的放大钮
  const exp = await page.$('.pmedia .vgexp');
  if (!exp) { console.log('NO EXPAND BTN'); }
  await exp.click();
  await page.waitForTimeout(1500);
  const info = await page.evaluate(()=>{
    const ov=document.getElementById('mvOverlay');
    const dark = getComputedStyle(document.body).backgroundColor;
    const theme = document.body.className;
    const mvv = getComputedStyle(document.getElementById('mediaViewer')).background.slice(0,80);
    const rows=[...ov.querySelectorAll('.mv-ctl button, .mv-round, .mv-follow')].map(b=>{
      const svg=b.querySelector('svg'); const p=svg&&svg.querySelector('path,circle,rect');
      const cs=getComputedStyle(b);
      return {act:b.dataset.mvact||'-', cls:b.className, bg:cs.backgroundColor, color:cs.color,
        svgStroke: p?p.getAttribute('stroke'):null, svgFill: p?p.getAttribute('fill'):null,
        pathColor: p?getComputedStyle(p).stroke:null, html:(svg?svg.outerHTML.slice(0,150):b.textContent)};
    });
    return {theme,bodyBg:dark,mvv,rows};
  });
  const box = await page.evaluate(()=>{const r=document.querySelector('.mv-ctl').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
  await page.screenshot({path:'D:/deepseek/gouzuoqu/U/uitest/mv48-bar.png', clip:{x:0,y:Math.max(0,box.y-60),width:420,height:180}});
  console.log(JSON.stringify({info,errs},null,1).slice(0,3000));
  await browser.close(); process.exit(0);
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
