
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('playwright-core');
const ROOT='D:/deepseek/gouzuoqu/U';
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript','.png':'image/png','.jpg':'image/jpeg','.css':'text/css','.json':'application/json'};
const srv=http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/')p='/index.html';
  const f=path.join(ROOT,p);
  fs.readFile(f,(e,b)=>{ if(e){res.writeHead(404);res.end('404');return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});res.end(b);});
});
(async()=>{
  await new Promise(r=>srv.listen(18860,r));
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:420,height:900},deviceScaleFactor:2});
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('http://127.0.0.1:18860/index.html',{waitUntil:'domcontentloaded'});
  await page.click('#guestBtn').catch(()=>{});
  await page.waitForTimeout(1200);
  const out=[];
  const T=(n,ok,extra)=>{const s=(ok?'PASS ':'FAIL ')+n+(extra?' :: '+extra:'');out.push(s);console.log(s);};

  // 抽屉里 只有 游戏，没有 丝袜/跳一跳
  T('drawer no silk/jump items', await page.evaluate(()=>!document.querySelector('[data-side=silk]')&&!document.querySelector('[data-side=jump]')));
  // 打开抽屉点游戏
  await page.evaluate(()=>{document.getElementById('sideDrawer').classList.add('open');document.getElementById('sideBackdrop')&&document.getElementById('sideBackdrop').classList.add('open');});
  await page.waitForTimeout(320);
  await page.click('[data-side=game]');
  await page.waitForTimeout(520);
  const lb=await page.evaluate(()=>{
    const s=document.getElementById('lobbySheet');
    const cards=[...s.querySelectorAll('[data-lb]')].map(c=>c.getAttribute('data-lb'));
    return {open:s.classList.contains('open'),cards,vis:getComputedStyle(s).visibility,title:s.querySelector('.lb-title').textContent,names:[...s.querySelectorAll('[data-lb] b')].map(b=>b.textContent)};
  });
  T('lobby opens', lb.open&&lb.vis==='visible', JSON.stringify({open:lb.open,vis:lb.vis}));
  T('lobby has 4 cards', lb.cards.join(',')==='fire,jump,silk,tear', lb.cards.join(','));
  T('lobby names', lb.names.join('/')==='火线行动/跳一跳/丝袜/可撕丝袜', lb.names.join('/'));
  await page.screenshot({path:ROOT+'/uitest/lobby47.png'});

  // 跳一跳
  await page.click('[data-lb=jump]');
  await page.waitForTimeout(700);
  const j=await page.evaluate(()=>({jump:document.getElementById('jumpSheet').classList.contains('open'),lobby:document.getElementById('lobbySheet').classList.contains('open')}));
  T('jump opens from lobby', j.jump&&!j.lobby, JSON.stringify(j));
  await page.evaluate(()=>{ if(window.closeJumpGame) window.closeJumpGame(); });
  await page.waitForTimeout(420);

  // 丝袜
  await page.evaluate(()=>{document.getElementById('sideDrawer').classList.add('open');});
  await page.waitForTimeout(300);
  await page.click('[data-side=game]');
  await page.waitForTimeout(450);
  await page.click('[data-lb=silk]');
  await page.waitForTimeout(900);
  const sk=await page.evaluate(()=>({silk:document.getElementById('silkSheet').classList.contains('open'),frame:!!(document.getElementById('yusiFrame')&&document.getElementById('yusiFrame').src)}));
  T('silk opens from lobby', sk.silk&&sk.frame, JSON.stringify(sk));
  await page.evaluate(()=>document.getElementById('silkSheet').classList.remove('open'));
  await page.waitForTimeout(300);

  // 火线行动
  await page.evaluate(()=>{document.getElementById('sideDrawer').classList.add('open');});
  await page.waitForTimeout(280);
  await page.click('[data-side=game]');
  await page.waitForTimeout(420);
  await page.click('[data-lb=fire]');
  await page.waitForTimeout(2500);
  const fire=await page.evaluate(()=>({game:document.getElementById('gameSheet').classList.contains('open')}));
  T('fire opens from lobby', fire.game, JSON.stringify(fire));
  await page.evaluate(()=>{ if(window.shooterCloseGame) shooterCloseGame(); });
  await page.waitForTimeout(400);

  // 可撕丝袜
  await page.evaluate(()=>{document.getElementById('sideDrawer').classList.add('open');});
  await page.waitForTimeout(280);
  await page.click('[data-side=game]');
  await page.waitForTimeout(420);
  await page.click('[data-lb=tear]');
  await page.waitForTimeout(900);
  const t0=await page.evaluate(()=>window.tearState());
  T('tear opens', t0.open&&t0.running, JSON.stringify(t0));
  const cbox=await page.evaluate(()=>{const c=document.getElementById('tearCanvas');const r=c.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
  T('canvas sized', cbox.w>300&&cbox.h>600, JSON.stringify(cbox));
  await page.screenshot({path:ROOT+'/uitest/tear47-before.png'});
  // 拖动撕裂
  const x0=cbox.x+cbox.w*0.5, y0=cbox.y+cbox.h*0.3;
  await page.mouse.move(x0,y0); await page.mouse.down();
  for(let i=0;i<14;i++){ await page.mouse.move(x0+Math.sin(i)*30, y0+i*18,{steps:3}); }
  await page.mouse.up();
  await page.waitForTimeout(400);
  const t1=await page.evaluate(()=>window.tearState());
  T('drag tears (pct up)', t1.pct>t0.pct, 'pct '+t0.pct+' -> '+t1.pct);
  const barW=await page.evaluate(()=>document.getElementById('tearBar').style.width);
  T('progress bar updated', parseFloat(barW)>0, barW);
  // 换色
  await page.click('[data-tear-color=white]');
  await page.waitForTimeout(300);
  const t2=await page.evaluate(()=>window.tearState());
  T('color switch', t2.color==='white', t2.color);
  // 全部撕开
  await page.waitForTimeout(200);
  await page.click('#tearRipAll');
  await page.waitForTimeout(600);
  const t3=await page.evaluate(()=>({s:window.tearState(),done:document.getElementById('tearDone').classList.contains('on')}));
  T('rip all fills', t3.s.pct>=88, JSON.stringify(t3.s));
  T('done tip shown', t3.done, String(t3.done));
  await page.screenshot({path:ROOT+'/uitest/tear47-after.png'});
  // 重来
  await page.click('#tearReset');
  await page.waitForTimeout(400);
  const t4=await page.evaluate(()=>window.tearState());
  T('reset clears', t4.pct===0, String(t4.pct));
  // 返回键关闭
  await page.click('#tearClose');
  await page.waitForTimeout(400);
  const t5=await page.evaluate(()=>({open:window.tearState().open,body:document.body.classList.contains('tear-open')}));
  T('close works', !t5.open&&!t5.body, JSON.stringify(t5));
  T('no pageerror', errs.length===0, errs.join(' | '));
  console.log(out.join('\n'));
  await browser.close(); srv.close();
  process.exit(0);
})().catch(e=>{console.error('FATAL',e); process.exit(1);});