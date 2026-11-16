const {chromium}=require('playwright-core'); const http=require('http'); const fs=require('fs'); const path=require('path');
const ROOT='D:/deepseek/gouzuoqu/U';
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'};
const srv=http.createServer((req,res)=>{ const u=decodeURIComponent(req.url.split('?')[0]); const p=path.join(ROOT, u==='/'?'index.html':u.replace(/^\//,''));
  fs.readFile(p,(e,b)=>{ if(e){res.writeHead(404);res.end('no');return;} res.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); res.end(b); }); });
(async()=>{ await new Promise(r=>srv.listen(18876,'127.0.0.1',r));
  const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await b.newPage({viewport:{width:420,height:900},deviceScaleFactor:2});
  const errs=[]; page.on('pageerror',e=>errs.push(String(e).slice(0,150)));
  await page.goto('http://127.0.0.1:18876/index.html',{waitUntil:'load',timeout:30000});
  await page.waitForTimeout(1000); await page.click('#guestBtn').catch(()=>{}); await page.waitForTimeout(900);
  await page.evaluate(()=>window.openTearGame());
  await page.waitForFunction(()=>window.tearState().built,{timeout:20000});
  await page.waitForTimeout(700);
  await page.screenshot({path:ROOT+'/.tmp-test/tear3-open.png'});
  const box=await page.evaluate(()=>{const s=document.getElementById('tearStage').getBoundingClientRect();return {x:s.x,y:s.y,w:s.width,h:s.height};});
  async function stroke(y0,y1){ await page.mouse.move(box.x+box.w*0.2,y0); await page.mouse.down();
    for(let i=0;i<30;i++){ const t=i/29; await page.mouse.move(box.x+box.w*(0.2+0.6*t), y0+(y1-y0)*t+Math.sin(i/2)*8); await page.waitForTimeout(12);}
    await page.mouse.up(); await page.waitForTimeout(60); }
  for(let s=0;s<8;s++){ const y0=box.y+box.h*(0.14+s*0.1); await stroke(y0, y0+box.h*0.06); }
  await page.waitForTimeout(700);
  const torn=await page.evaluate(()=>window.tearState());
  await page.screenshot({path:ROOT+'/.tmp-test/tear3-torn.png'});
  await page.waitForFunction(()=>window.tearState().layer>1,{timeout:10000}).catch(()=>errs.push('no advance'));
  const adv=await page.evaluate(()=>window.tearState());
  await page.waitForTimeout(900);
  await page.screenshot({path:ROOT+'/.tmp-test/tear3-next.png'});
  await page.click('[data-tear-color=\"wine\"]'); await page.waitForTimeout(400);
  await page.screenshot({path:ROOT+'/.tmp-test/tear3-wine.png'});
  const fin=await page.evaluate(()=>window.tearState());
  console.log(JSON.stringify({torn,adv,fin,errs,box}));
  await b.close(); srv.close();
})().catch(e=>{console.log('FATAL',e.message); process.exit(1);});