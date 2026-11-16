const {chromium}=require('playwright-core'); const http=require('http'); const fs=require('fs'); const path=require('path');
const ROOT='D:/deepseek/gouzuoqu/U/.tmp-test/gh';
const srv=http.createServer((req,res)=>{ const p=path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//,'')||'index.html');
  fs.readFile(p,(e,b)=>{ if(e){res.writeHead(404);res.end('no');return;} const ext=path.extname(p);
  res.writeHead(200,{'content-type': ext==='.html'?'text/html; charset=utf-8': ext==='.js'?'text/javascript':'text/css'}); res.end(b); }); });
(async()=>{ await new Promise(r=>srv.listen(18873,'127.0.0.1',r));
  const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for (const [file,out] of [['tear_meso.html','meso'],['tear_arti.html','arti']]) {
    const p=await b.newPage({viewport:{width:420,height:900},deviceScaleFactor:1});
    const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,120)));
    await p.goto('http://127.0.0.1:18873/'+file,{waitUntil:'load',timeout:30000}).catch(e=>errs.push('goto '+e.message.slice(0,60)));
    await p.waitForTimeout(3500);
    await p.screenshot({path:'D:/deepseek/gouzuoqu/U/.tmp-test/gh/'+out+'-0.png'});
    await p.mouse.move(150,400); await p.mouse.down();
    for (let i=0;i<24;i++){ await p.mouse.move(150+i*10, 400+Math.sin(i/3)*60); await p.waitForTimeout(16);}
    await p.mouse.up(); await p.waitForTimeout(800);
    await p.screenshot({path:'D:/deepseek/gouzuoqu/U/.tmp-test/gh/'+out+'-1.png'});
    const info=await p.evaluate(()=>({canvas:[...document.querySelectorAll('canvas')].map(c=>c.width+'x'+c.height), text:(document.body.innerText||'').slice(0,120)}));
    console.log(file, JSON.stringify(info), 'errs', JSON.stringify(errs.slice(0,3)));
    await p.close();
  }
  await b.close(); srv.close();
})().catch(e=>{console.log('FATAL',e.message); process.exit(1);});