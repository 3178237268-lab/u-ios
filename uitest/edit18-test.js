
const {chromium}=require('playwright-core');
const {spawn}=require('child_process');
const http=require('http'), fs=require('fs'), path=require('path');
const ROOT='D:/deepseek/gouzuoqu/U';
fs.rmSync(path.join(ROOT,'uitest/edit-data'),{recursive:true,force:true});
const srv=spawn(process.execPath,[path.join(ROOT,'server/src/server.js')],{cwd:path.join(ROOT,'server'),env:{...process.env,PORT:'18944',U_DISCOVER_PORT:'18762',U_DATA_DIR:path.join(ROOT,'uitest/edit-data')},stdio:'ignore'});
const stat=http.createServer((q,s)=>{const f=path.join(ROOT,q.url.split('?')[0]);fs.readFile(f,(e,b)=>{if(e){s.writeHead(404);s.end('x');return;}s.writeHead(200,{'content-type':f.endsWith('.html')?'text/html':'application/octet-stream'});s.end(b);});}).listen(18945);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await sleep(1500);
  await fetch('http://127.0.0.1:18944/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'edt',password:'123456'})});
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage({viewport:{width:420,height:900},deviceScaleFactor:2});
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.addInitScript(()=>{localStorage.setItem('u-server','http://127.0.0.1:18944');});
  await page.goto('http://127.0.0.1:18945/index.html',{waitUntil:'domcontentloaded'});
  await sleep(1200);
  await page.fill('#authUser','edt'); await page.fill('#authPass','123456'); await page.click('#authSubmit');
  await sleep(2500);
  // 1) 发一条不带 18+ 的视频帖
  await page.click('#composeBtn'); await sleep(500);
  await page.setInputFiles('#filePicker',path.join(ROOT,'uitest/tmp1.mp4'));
  for(let i=0;i<40;i++){ await sleep(500); const c=await page.textContent('#mediaCount'); if(c&&c.startsWith('1/')) break; }
  await sleep(1500);
  await page.click('#composePublish'); await sleep(6000);
  let j=await (await fetch('http://127.0.0.1:18944/api/posts?limit=5')).json();
  console.log('after publish', JSON.stringify((j.posts||[]).map(p=>({id:p.id,sensitive:p.sensitive}))));
  // 2) 打开自己帖子的「更多」→ 编辑帖子 → 打开 18+ → 保存
  await page.evaluate(()=>{ const m=document.querySelector('.tab[data-tab="talk"]'); if(m) m.click(); });
  await sleep(1200);
  const hasPost = await page.evaluate(()=>document.querySelectorAll('.post .pmore').length);
  console.log('posts with more button', hasPost);
  await page.evaluate(()=>{ const b=document.querySelector('.post .pmore'); b.click(); });
  await sleep(600);
  await page.click('#menuEdit'); await sleep(900);
  await page.click('#sensRow');
  console.log('sens checked', await page.evaluate(()=>document.getElementById('composeSensitive').checked));
  await page.click('#composePublish'); await sleep(5000);
  j=await (await fetch('http://127.0.0.1:18944/api/posts?limit=5')).json();
  console.log('after edit', JSON.stringify((j.posts||[]).map(p=>({id:p.id,sensitive:p.sensitive}))));
  const dom=await page.evaluate(()=>Array.from(document.querySelectorAll('.post')).map(p=>({id:p.dataset.id, veil:!!p.querySelector('.pveil'), cls:(p.querySelector('.pmedia')||{}).className})));
  console.log('dom', JSON.stringify(dom));
  console.log('errs', errs.slice(0,3));
  await browser.close(); srv.kill(); stat.close(); process.exit(0);
})().catch(e=>{console.error('FATAL',e.message);srv.kill();stat.close();process.exit(1);});
