
const {chromium}=require('playwright-core');
const {spawn}=require('child_process');
const http=require('http'), fs=require('fs'), path=require('path');
const ROOT='D:/deepseek/gouzuoqu/U';
fs.rmSync(path.join(ROOT,'uitest/edit5-data'),{recursive:true,force:true});
const srv=spawn(process.execPath,[path.join(ROOT,'server/src/server.js')],{cwd:path.join(ROOT,'server'),env:{...process.env,PORT:'18954',U_DISCOVER_PORT:'18767',U_DATA_DIR:path.join(ROOT,'uitest/edit5-data')},stdio:'ignore'});
const stat=http.createServer((q,s)=>{const f=path.join(ROOT,q.url.split('?')[0]);fs.readFile(f,(e,b)=>{if(e){s.writeHead(404);s.end('x');return;}s.writeHead(200,{'content-type':f.endsWith('.html')?'text/html':'application/octet-stream'});s.end(b);});}).listen(18955);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await sleep(3000);
  await fetch('http://127.0.0.1:18954/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'edt5',password:'123456'})}).then(r=>r.json()).then(d=>console.log('user', d.user&&d.user.id));
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
  const ctx=await browser.newContext({viewport:{width:420,height:900},deviceScaleFactor:2});
  const page=await ctx.newPage();
  const errs=[];page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>console.log('CONSOLE',m.type(),m.text().slice(0,160)));page.on('request',r=>{if(r.url().includes('/api/posts/')) console.log('REQ',r.method(),r.url(),r.postData());});
  await page.addInitScript(()=>{localStorage.setItem('u-server','http://127.0.0.1:18954');});
  await page.goto('http://127.0.0.1:18955/index.html',{waitUntil:'domcontentloaded'});
  await sleep(1200);
  await page.fill('#authUser','edt5'); await page.fill('#authPass','123456'); await page.click('#authSubmit');
  await sleep(2500);
  await page.click('#composeBtn'); await sleep(500);
  await page.setInputFiles('#filePicker',path.join(ROOT,'uitest/tmp1.mp4'));
  for(let i=0;i<40;i++){ await sleep(500); const c=await page.textContent('#mediaCount'); if(c&&c.startsWith('1/')) break; }
  await sleep(1500);
  await page.click('#composePublish'); await sleep(6000);
  let j=await (await fetch('http://127.0.0.1:18954/api/posts?limit=5')).json();
  console.log('published', JSON.stringify((j.posts||[]).map(p=>({id:p.id,sensitive:p.sensitive,poster:p.media[0]&&p.media[0].poster?'P':'-'}))));
  // 刷新：本机 blob 全部失效，等效于「换台设备/重开 App 后去编辑」
  await page.reload({waitUntil:'domcontentloaded'}); await sleep(2600);
  await page.evaluate(()=>{ const m=document.querySelector('.tab[data-tab="talk"]'); if(m) m.click(); });
  await sleep(1200);
  const info=await page.evaluate(()=>{ const p=document.querySelector('.post'); return p? {id:p.dataset.id,more:!!p.querySelector('.pmore'),veil:!!p.querySelector('.pveil')}:null; });
  console.log('post dom', JSON.stringify(info));
  await page.evaluate(()=>document.querySelector('.post .pmore').click());
  await sleep(600);
  await page.click('#menuEdit'); await sleep(900);
  await page.click('#sensRow');
  await page.click('#composePublish'); await sleep(4000);
  j=await (await fetch('http://127.0.0.1:18954/api/posts?limit=5')).json();
  console.log('after PATCH', JSON.stringify((j.posts||[]).map(p=>({id:p.id,sensitive:p.sensitive}))));
  const dom=await page.evaluate(()=>Array.from(document.querySelectorAll('.post')).map(p=>({id:p.dataset.id, veil:!!p.querySelector('.pveil'), cls:(p.querySelector('.pmedia')||{}).className})));
  console.log('dom', JSON.stringify(dom));
  console.log('errs', errs.slice(0,3));
  await browser.close(); srv.kill(); stat.close(); process.exit(0);
})().catch(e=>{console.error('FATAL',e.message);srv.kill();stat.close();process.exit(1);});