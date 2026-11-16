const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('playwright-core');
const ROOT='D:/deepseek/gouzuoqu/U';
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css'};
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);res.end('nf');return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});res.end(d);});});
(async()=>{
await new Promise(r=>srv.listen(18899,r));
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox','--disable-gpu']});
const ctx=await b.newContext({viewport:{width:420,height:900},deviceScaleFactor:2});
const page=await ctx.newPage();
await page.goto('http://127.0.0.1:18899/index.html');
const out=await page.evaluate(async()=>{
  const ids=['aa136cd84fd201060e211ccd','f11edacb398ea26448c2b7ce','e644875e4e4b48961565e63f'];
  const r=[];
  for(const id of ids){
    const u='http://127.0.0.1:8787/media/'+id;
    const ok=await new Promise(res=>{const img=new Image();img.onload=()=>res(img.naturalWidth+'x'+img.naturalHeight);img.onerror=()=>res('ERR');img.src=u;});
    r.push({id:u.slice(-8),ok});
  }
  return r;
});
console.log('IMG',JSON.stringify(out));
await b.close();srv.close();
})();