const fs=require('fs'),path=require('path');
const {DatabaseSync}=require('node:sqlite');
const {chromium}=require('playwright-core');
const SRV='http://127.0.0.1:8787';
const MEDIA='D:/deepseek/gouzuoqu/U/11111/data/media';
const db=new DatabaseSync('D:/deepseek/gouzuoqu/U/11111/data/u.db',{readOnly:true});
const vids=db.prepare("SELECT id,poster,ratio,mime FROM media WHERE mime LIKE 'video/%'").all();
function head(p){try{const fd=fs.openSync(path.join(MEDIA,p),'r');const b=Buffer.alloc(4);fs.readSync(fd,b,0,4,0);fs.closeSync(fd);return b.toString('latin1');}catch(e){return '';}}
const todo=vids.filter(v=>{const h=v.poster?head(v.poster):'';return !v.poster||!/^\xff\xd8|^\x89PNG/.test(h);});
console.log('videos',vids.length,'needFix',todo.length);
console.log(todo.map(t=>t.id+':'+(t.poster||'-')).join(' '));
(async()=>{
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
const page=await b.newPage();
await page.goto(SRV+'/index.html').catch(()=>{});
const token=await page.evaluate(async()=>{const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin123',password:'admin123'})});const d=await r.json();return d.token||'';});
console.log('token',token?'ok':'FAIL');
for(const v of todo){
  const out=await page.evaluate(async({vid,token})=>{
    const v=document.createElement('video');
    v.muted=true;v.playsInline=true;v.preload='auto';v.crossOrigin='anonymous';
    v.src='http://127.0.0.1:8787/media/'+vid;
    document.body.appendChild(v);
    const ready=await new Promise(res=>{const t=setTimeout(()=>res(false),25000);v.addEventListener('loadeddata',()=>{clearTimeout(t);res(true);},{once:true});v.addEventListener('error',()=>{clearTimeout(t);res(false);},{once:true});});
    if(!ready||!v.videoWidth){v.remove();return {err:'nodecode'};}
    const c=document.createElement('canvas');
    const W=Math.min(720,v.videoWidth);const H=Math.round(W*v.videoWidth? W*v.videoHeight/v.videoWidth:0);
    c.width=W;c.height=Math.round(W*v.videoHeight/v.videoWidth);
    const ctx=c.getContext('2d');
    const TS=[0.12,0.6,1.2,2.4,4.0];
    let best=null;
    for(const ts of TS){
      await new Promise(res=>{v.addEventListener('seeked',()=>res(),{once:true});v.currentTime=Math.min(ts,Math.max(0.1,(v.duration||1)-0.1));setTimeout(res,4000);});
      ctx.drawImage(v,0,0,c.width,c.height);
      const d=ctx.getImageData(0,0,c.width,c.height).data;let s=0,n=0;
      for(let i=0;i<d.length;i+=4*97){s+=(d[i]+d[i+1]+d[i+2])/3;n++;}
      const mean=s/n;
      if(mean>=10){best={mean:mean};break;}
      best={mean:mean};
    }
    if(!best||best.mean<10){v.remove();return {err:'black',mean:best&&best.mean};}
    const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.82));
    const buf=await blob.arrayBuffer();
    const ratio=Math.round(v.videoWidth/v.videoHeight*1000)/1000;
    const res=await fetch('http://127.0.0.1:8787/api/media/'+vid+'/poster',{method:'POST',headers:{'Content-Type':'image/jpeg','X-Ratio':String(ratio),'Authorization':'Bearer '+token},body:buf});
    const js=await res.json().catch(()=>({}));
    v.remove();
    return {status:res.status,poster:js.poster||'',ratio:ratio,mean:Math.round(best.mean),bytes:buf.byteLength};
  },{vid:v.id,token});
  console.log(v.id, JSON.stringify(out).slice(0,160));
}
await b.close();
})();