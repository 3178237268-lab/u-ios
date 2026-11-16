
const fs=require('fs');
const B='http://127.0.0.1:8787';
(async()=>{
  const out={};
  const posts=await (await fetch(B+'/api/posts?limit=100')).json();
  const items=posts.items||posts.posts||[];
  out.count=items.length;
  const withMedia=items.filter(p=>(p.media||[]).length);
  out.withMedia=withMedia.length;
  out.sample=withMedia.slice(0,3).map(p=>({id:p.id, sens:p.sensitive, media:(p.media||[]).slice(0,3).map(m=>({id:m.id,type:m.type,src:m.src,poster:m.poster&&m.poster.slice(0,40),ratio:m.ratio}))}));
  const mid=(withMedia[0]&&withMedia[0].media[0]||{}).id;
  const vid=(withMedia.find(p=>(p.media||[]).some(m=>m.type==='video'))||{media:[]}).media.find(m=>m.type==='video');
  out.videoId=vid&&vid.id;
  // 1) 无 token 取封面
  const r1=await fetch(B+'/media/'+mid);
  out.noAuth={status:r1.status, type:r1.headers.get('content-type'), len:r1.headers.get('content-length')};
  // 2) 无 token 取视频 + Range
  if(vid){
    const r2=await fetch(B+'/media/'+vid.id,{headers:{Range:'bytes=0-1023'}});
    out.range={status:r2.status, cr:r2.headers.get('content-range'), ar:r2.headers.get('accept-ranges'), type:r2.headers.get('content-type'), len:r2.headers.get('content-length')};
    const r3=await fetch(B+'/media/'+vid.id,{method:'GET'});
    out.full={status:r3.status, len:r3.headers.get('content-length')};
    r3.body&&r3.body.cancel&&r3.body.cancel();
  }
  console.log(JSON.stringify(out,null,1));
})();
