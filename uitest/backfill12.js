
const {chromium}=require('playwright-core');
const BASE='http://127.0.0.1:8787';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const lg=await (await fetch(BASE+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'admin123',password:'admin123'})})).json();
  const token=lg.token; if(!token){console.log('login failed',JSON.stringify(lg));process.exit(1);}
  const j=await (await fetch(BASE+'/api/posts?limit=200')).json();
  const posts=(j.posts||[]).filter(p=>[1137,1138].includes(Number(p.id)));
  const targets=[];
  posts.forEach(p=>p.media.forEach(m=>{ if(!m.poster) targets.push({media:m.id,post:p.id,mime:m.mime}); }));
  console.log('need posters:',targets.length);
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage();
  await page.goto(BASE+'/admin.html',{waitUntil:'domcontentloaded'});
  for(const t of targets){
    const res=await page.evaluate(async (o)=>{
      const cap=(url,ts)=>new Promise(res=>{
        const v=document.createElement('video');v.muted=true;v.crossOrigin='anonymous';v.preload='auto';v.src=url;
        let done=false, i=0;
        const fin=(r)=>{if(done)return;done=true;try{v.pause();v.removeAttribute('src');v.load();}catch(e){};res(r);};
        const grab=()=>{
          if(!v.videoWidth){fin({err:'nodecode'});return;}
          const s=Math.min(1,720/Math.max(v.videoWidth,v.videoHeight));
          const c=document.createElement('canvas');c.width=Math.round(v.videoWidth*s);c.height=Math.round(v.videoHeight*s);
          const cx=c.getContext('2d');cx.drawImage(v,0,0,c.width,c.height);
          let mean=-1;try{const d=cx.getImageData(0,0,c.width,c.height).data;let sum=0,n=0;for(let k=0;k<d.length;k+=4*53){sum+=d[k]*0.299+d[k+1]*0.587+d[k+2]*0.114;n++;}mean=sum/n;}catch(e){}
          if(mean>=0&&mean<8){i++;if(i>=ts.length){fin({err:'black'});return;}seek(ts[i]);return;}
          fin({poster:c.toDataURL('image/jpeg',0.82),ratio:Math.round(v.videoWidth/v.videoHeight*1000)/1000,mean:Math.round(mean)});
        };
        const seek=(t)=>{const d=isFinite(v.duration)?v.duration:0;try{v.currentTime=d>0.4?Math.min(t,d-0.1):t;}catch(e){fin({err:'seek'});}};
        const TS=[0.6,1.2,2.4,4.0];ts=TS;
        const timer=setTimeout(()=>fin({err:'timeout'}),25000);
        v.addEventListener('loadedmetadata',()=>seek(ts[0]));
        v.addEventListener('seeked',()=>setTimeout(grab,120));
        v.addEventListener('error',()=>{clearTimeout(timer);fin({err:'error'});});
        setTimeout(()=>{clearTimeout(timer);},25000);
      });
      return await cap(o.url);
    },{url:BASE+'/media/'+t.media});
    if(!res || res.err){ console.log('SKIP',t.media,res&&res.err); continue; }
    const bin=Buffer.from(res.poster.split(',')[1],'base64');
    const fd=new FormData();
    fd.append('file', new Blob([bin],{type:'image/jpeg'}), 'p-'+t.media+'.jpg');
    fd.append('ratio', String(res.ratio||0));
    const up=await fetch(BASE+'/api/media/'+t.media+'/poster',{method:'POST',headers:{authorization:'Bearer '+token},body:fd});
    console.log('UP',t.media,up.status,'mean='+res.mean,(await up.text()).slice(0,90));
  }
  await browser.close();
  const after=await (await fetch(BASE+'/api/posts?limit=200')).json();
  const chk=(after.posts||[]).filter(p=>[1137,1138].includes(Number(p.id))).map(p=>({id:p.id,sens:p.sensitive,media:p.media.map(m=>m.poster?'P':'-').join('')}));
  console.log('RESULT',JSON.stringify(chk));
  process.exit(0);
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
