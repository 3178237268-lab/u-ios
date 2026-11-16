const {chromium}=require('playwright-core');
const SRV='http://127.0.0.1:8787';
const targets=['642794e2dcc6f4c549b56c04','b1788554b168417021638702','6be2d73d8e212c76699f11f5'];
(async()=>{
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
const page=await b.newPage();
await page.goto(SRV+'/index.html').catch(()=>{});
const token=await page.evaluate(async()=>{const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin123',password:'admin123'})});const d=await r.json();return d.token||'';});
console.log('token',token?'ok':'FAIL');
for(const vid of targets){
  const out=await page.evaluate(async({vid,token})=>{
    const v=document.createElement('video');v.muted=true;v.playsInline=true;v.preload='auto';v.crossOrigin='anonymous';
    v.src='http://127.0.0.1:8787/media/'+vid;document.body.appendChild(v);
    const ready=await new Promise(res=>{const t=setTimeout(()=>res(false),25000);v.addEventListener('loadeddata',()=>{clearTimeout(t);res(true);},{once:true});v.addEventListener('error',()=>{clearTimeout(t);res(false);},{once:true});});
    if(!ready||!v.videoWidth){v.remove();return {err:'nodecode'};}
    const c=document.createElement('canvas');c.width=720;c.height=Math.round(720*v.videoHeight/v.videoWidth);
    const ctx=c.getContext('2d');
    const dur=v.duration||6;
    const TS=[1,2,3.5,5,7,10,14,20,Math.max(1,dur*0.25),Math.max(1,dur*0.5),Math.max(1,dur*0.75)];
    let best={mean:-1,blob:null};
    for(const ts of TS){
      const t=Math.min(ts,Math.max(0.2,dur-0.2));
      await new Promise(res=>{v.addEventListener('seeked',()=>res(),{once:true});v.currentTime=t;setTimeout(res,5000);});
      ctx.drawImage(v,0,0,c.width,c.height);
      const d=ctx.getImageData(0,0,c.width,c.height).data;let s=0,n=0;
      for(let i=0;i<d.length;i+=4*97){s+=(d[i]+d[i+1]+d[i+2])/3;n++;}
      const mean=s/n;
      if(mean>best.mean){const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.82));best={mean:mean,blob:blob,ts:t};}
      if(mean>=40)break;
    }
    const buf=await best.blob.arrayBuffer();
    const ratio=Math.round(v.videoWidth/v.videoHeight*1000)/1000;
    const res=await fetch('http://127.0.0.1:8787/api/media/'+vid+'/poster',{method:'POST',headers:{'Content-Type':'image/jpeg','X-Ratio':String(ratio),'Authorization':'Bearer '+token},body:buf});
    const js=await res.json().catch(()=>({}));
    v.remove();return {status:res.status,mean:Math.round(best.mean),ts:best.ts,bytes:buf.byteLength,poster:js.poster};
  },{vid,token});
  console.log(vid, JSON.stringify(out).slice(0,170));
}
await b.close();
})();