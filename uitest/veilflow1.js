
const {chromium}=require('playwright-core');
const {spawn}=require('child_process');
const http=require('http'), fs=require('fs'), path=require('path');
const ROOT='D:/deepseek/gouzuoqu/U';
const srv=spawn(process.execPath,[path.join(ROOT,'server/src/server.js')],{cwd:path.join(ROOT,'server'),env:{...process.env,PORT:'18940',U_DISCOVER_PORT:'18760',U_DATA_DIR:path.join(ROOT,'uitest/veil-data')},stdio:'ignore'});
const stat=http.createServer((q,s)=>{const f=path.join(ROOT,q.url.split('?')[0]);fs.readFile(f,(e,b)=>{if(e){s.writeHead(404);s.end('x');return;}s.writeHead(200,{'content-type':f.endsWith('.html')?'text/html':'application/octet-stream'});s.end(b);});}).listen(18941);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await sleep(1500);
  const reg=await fetch('http://127.0.0.1:18940/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'veiluser',password:'123456'})});
  console.log('register',reg.status,(await reg.text()).slice(0,160));
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage({viewport:{width:420,height:900},deviceScaleFactor:2});
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.addInitScript(()=>{localStorage.setItem('u-server','http://127.0.0.1:18940');});
  await page.goto('http://127.0.0.1:18941/index.html',{waitUntil:'domcontentloaded'});
  await sleep(1200);
  await page.fill('#authUser','veiluser'); await page.fill('#authPass','123456'); await page.click('#authSubmit');
  await sleep(2500);
  console.log('logged in:', await page.evaluate(()=>!!document.querySelector('.app') && !document.getElementById('authScreen').classList.contains('on')));
  await page.click('#composeBtn');
  await sleep(600);
  await page.setInputFiles('#filePicker',path.join(ROOT,'uitest/tmp1.mp4'));
  for(let i=0;i<30;i++){ await sleep(500); const c=await page.textContent('#mediaCount'); if(c && c.startsWith('1/')) break; }
  const st1=await page.evaluate(()=>({count:document.getElementById('mediaCount').textContent,cloud:!!document.querySelector('#composePreview .cloud'),pub:document.getElementById('composePublish').className}));
  console.log('after add',JSON.stringify(st1));
  await page.click('#sensRow');
  const chk=await page.evaluate(()=>document.getElementById('composeSensitive').checked);
  console.log('sens checked =',chk);
  await page.click('#composePublish');
  await sleep(6000);
  const j=await (await fetch('http://127.0.0.1:18940/api/posts?limit=5')).json();
  console.log('server posts',JSON.stringify((j.posts||[]).map(p=>({id:p.id,sensitive:p.sensitive,media:(p.media||[]).map(m=>m.mime+':'+(m.poster?'P':'-'))}))));
  console.log('errs',errs.slice(0,3));
  await browser.close(); srv.kill(); stat.close(); process.exit(0);
})().catch(e=>{console.error('FATAL',e.message);srv.kill();stat.close();process.exit(1);});
