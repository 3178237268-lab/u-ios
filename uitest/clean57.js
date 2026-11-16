
const B='http://127.0.0.1:8787';
(async()=>{
  const out={};
  const ld=await (await fetch(B+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'admin123',password:'admin123'})})).json();
  const H={authorization:'Bearer '+ld.token,'content-type':'application/json'};
  const posts=await (await fetch(B+'/api/posts?limit=100',{headers:H})).json();
  const list=posts.items||posts.posts||[];
  const t=list.filter(p=>(p.text||'').indexOf('E2E57')>=0);
  out.testPosts=t.map(p=>({id:p.id,media:(p.media||[]).map(m=>m.id)}));
  const pids=t.map(p=>p.id); const mids=[].concat(...t.map(p=>(p.media||[]).map(m=>m.id)));
  if(pids.length) out.delPost=await (await fetch(B+'/api/admin/posts/bulk-delete',{method:'POST',headers:H,body:JSON.stringify({ids:pids})})).json();
  if(mids.length) out.delMedia=await (await fetch(B+'/api/admin/media/bulk-delete',{method:'POST',headers:H,body:JSON.stringify({ids:mids})})).json();
  const users=await (await fetch(B+'/api/admin/users',{headers:H})).json();
  const vu=(users.items||users.users||[]).filter(u=>u.username==='viewer57').map(u=>u.id);
  out.viewerId=vu;
  if(vu.length) out.delUser=await (await fetch(B+'/api/admin/users/bulk-delete',{method:'POST',headers:H,body:JSON.stringify({ids:vu})})).json();
  const after=await (await fetch(B+'/api/posts?limit=100',{headers:H})).json();
  out.postsAfter=(after.items||after.posts||[]).length;
  console.log(JSON.stringify(out,null,1).slice(0,1500));
})();
