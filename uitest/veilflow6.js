
const {chromium}=require('playwright-core');
const {spawn}=require('child_process');
const http=require('http'), fs=require('fs'), path=require('path');
const ROOT='D:/deepseek/gouzuoqu/U';
fs.rmSync(path.join(ROOT,'uitest/veil-data2'),{recursive:true,force:true});
const srv=spawn(process.execPath,[path.join(ROOT,'server/src/server.js')],{cwd:path.join(ROOT,'server'),env:{...process.env,PORT:'18942',U_DISCOVER_PORT:'18761',U_DATA_DIR:path.join(ROOT,'uitest/veil-data2')},stdio:'ignore'});
const stat=http.createServer((q,s)=>{const f=path.join(ROOT,q.url.split('?')[0]);fs.readFile(f,(e,b)=>{if(e){s.writeHead(404);s.end('x');return;}s.writeHead(200,{'content-type':f.endsWith('.html')?'text/html':'application/octet-stream'});s.end(b);});}).listen(18943);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await sleep(1500);
  const reg=await fetch('http://127.0.0.1:18942/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'veil6',password:'123456'})});
  console.log('register',reg.status);
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage({viewport:{width:420,height:900},deviceScaleFactor:2});
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.addInitScript(()=>{localStorage.setItem('u-server','http://127.0.0.1:18942');});
  await page.goto('http://127.0.0.1:18943/index.html',{waitUntil:'domcontentloaded'});
  await sleep(1200);
  await page.fill('#authUser','veil6'); await page.fill('#authPass','123456'); await page.click('#authSubmit');
  await sleep(2500);
  await page.click('#composeBtn'); await sleep(500);
  const files=[1,2,3,4,5,6].map(i=>path.join(ROOT,'uitest/tmp'+i+'.mp4'));
  await page.setInputFiles('#filePicker',files);
  for(let i=0;i<80;i++){ await sleep(500); const c=await page.textContent('#mediaCount'); if(c && c.startsWith('6/')) { const busy=await page.evaluate(()=>!!document.querySelector('#composePreview .cloud')); if(!busy) break; } }
  console.log('count', await page.textContent('#mediaCount'));
  await page.click('#sensRow');
  console.log('sens checked =', await page.evaluate(()=>document.getElementById('composeSensitive').checked));
  await page.click('#composePublish');
  await sleep(15000);
  const j=await (await fetch('http://127.0.0.1:18942/api/posts?limit=5')).json();
  console.log('server',JSON.stringify((j.posts||[]).map(p=>({id:p.id,sensitive:p.sensitive,media:(p.media||[]).map(m=>m.mime+':'+(m.poster?'P':'-'))}))));
  console.log('errs',errs.slice(0,3));
  await browser.close(); srv.kill(); stat.close(); process.exit(0);
})().catch(e=>{console.error('FATAL',e.message);srv.kill();stat.close();process.exit(1);});
