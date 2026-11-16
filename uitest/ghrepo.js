const cands=['GACN/fabric-real-simulation-md3','mesomya/tearable-cloth','artimoradi1382-design/tearable-cloth-project','scottstts/Break-That-Denim','javeke/ripit','Jane-xiaoer/claude-skill-tearable-cloth'];
(async()=>{for(const c of cands){
  try{const r=await fetch('https://api.github.com/repos/'+c,{headers:{'user-agent':'u-app'}}); const j=await r.json();
    console.log('REPO',c,'|',j.description||'','| lang',j.language,'| size',j.size,'| home',j.homepage||'','| updated',j.updated_at);
  }catch(e){console.log('ERR',c,e.message);}
}})();