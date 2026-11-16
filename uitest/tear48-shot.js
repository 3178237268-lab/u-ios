
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('playwright-core');
const ROOT='D:/deepseek/gouzuoqu/U';
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript','.png':'image/png','.jpg':'image/jpeg'};
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
  fs.readFile(path.join(ROOT,p),(e,b)=>{if(e){res.writeHead(404);res.end('404');return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'});res.end(b);});});
(async()=>{
  await new Promise(r=>srv.listen(18861,r));
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage({viewport:{width:420,height:900},deviceScaleFactor:2});
  await page.goto('http://127.0.0.1:18861/index.html',{waitUntil:'domcontentloaded'});
  await page.click('#guestBtn').catch(()=>{});
  await page.waitForTimeout(1000);
  await page.evaluate(()=>{window.openTearGame&&window.openTearGame();});
  await page.waitForTimeout(700);
  // 一条斜向撕口 + 一条横向
  await page.mouse.move(210,300); await page.mouse.down();
  for(let i=0;i<12;i++){ await page.mouse.move(210+i*9,300+i*16,{steps:2}); }
  await page.mouse.up();
  await page.waitForTimeout(150);
  await page.mouse.move(150,620); await page.mouse.down();
  for(let i=0;i<10;i++){ await page.mouse.move(150+i*16,620+i*3,{steps:2}); }
  await page.mouse.up();
  await page.waitForTimeout(600);
  console.log(JSON.stringify(await page.evaluate(()=>window.tearState())));
  await page.screenshot({path:ROOT+'/uitest/tear48-drag.png'});
  await browser.close(); srv.close(); process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
