async function q(s){ const u='https://api.github.com/search/repositories?per_page=8&q='+encodeURIComponent(s); const r=await fetch(u,{headers:{accept:'application/vnd.github+json','user-agent':'u-app'}}); const j=await r.json(); console.log('Q',s,'total',j.total_count); (j.items||[]).forEach(i=>console.log(' -',i.full_name,'|',String(i.description||'').slice(0,60),'|',i.homepage||'','|',i.default_branch)); }
(async()=>{
 await q('fabric-tear in:name');
 await q('fabric-tear.vercel.app');
 await q('tearable cloth in:name');
 await q('cloth tear simulation');
})().catch(e=>console.log('ERR',e.message));