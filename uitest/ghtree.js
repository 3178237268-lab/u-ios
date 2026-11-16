const repos=['mesomya/tearable-cloth','artimoradi1382-design/tearable-cloth-project','javeke/ripit','GACN/fabric-real-simulation-md3'];
(async()=>{for(const r of repos){
  try{const res=await fetch('https://api.github.com/repos/'+r+'/git/trees/HEAD?recursive=1',{headers:{'user-agent':'u-app'}}); const j=await res.json();
    const files=(j.tree||[]).filter(x=>x.type==='blob').map(x=>x.path+'('+x.size+')');
    console.log('== '+r+' files='+files.length); console.log(files.slice(0,40).join('\n'));
  }catch(e){console.log('ERR',r,String(e.message).slice(0,60));}
}})();