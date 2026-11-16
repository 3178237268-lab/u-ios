const {execSync}=require('child_process');
(async()=>{
  const out={};
  for (const ip of ['76.76.21.21','76.76.21.9','216.198.79.1','216.150.1.1']) {
    const cmd='curl -sS -m 8 --resolve fabric-tear.vercel.app:443:'+ip+" -o /tmp/v.html -w '%{http_code} %{size_download}' https://fabric-tear.vercel.app/";
    try { out['ip:'+ip]=execSync(cmd,{encoding:'utf8',stdio:['ignore','pipe','ignore']}); } catch(e){ out['ip:'+ip]='fail'; }
  }
  for (const u of ['https://grep.app/api/search?q=fabric-tear','https://api.grep.app/search?q=fabric-tear']) {
    try { const r=await fetch(u,{signal:AbortSignal.timeout(8000)}); out[u.slice(8,30)]=r.status+' '+(await r.text()).slice(0,100);} catch(e){ out[u.slice(8,30)]='ERR '+String(e.message).slice(0,40); }
  }
  try { const r=await fetch('https://api.github.com/search/repositories?q=fabric+tear&per_page=10',{headers:{'accept':'application/vnd.github+json','user-agent':'u-app'},signal:AbortSignal.timeout(10000)});
    const j=await r.json(); out.gh=(j.items||[]).map(i=>i.full_name+' | '+String(i.description||'').slice(0,50)+' | '+(i.homepage||'')).slice(0,10); } catch(e){ out.gh='ERR '+String(e.message).slice(0,60); }
  console.log(JSON.stringify(out,null,1).slice(0,2500));
})();