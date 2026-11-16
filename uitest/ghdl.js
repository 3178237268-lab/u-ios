const fs=require('fs'); const path=require('path');
const items=[['mesomya/tearable-cloth','index.html','tear_meso.html'],['GACN/fabric-real-simulation-md3','%E9%9D%A2%E6%96%99%E7%9C%9F%E5%AE%9E%E4%BB%BF%E7%9C%9F-%E5%8D%95%E6%96%87%E4%BB%B6%E7%89%88.html','tear_gacn.html'],['artimoradi1382-design/tearable-cloth-project','tearable%20cloth%20project/index.html','tear_arti.html'],['artimoradi1382-design/tearable-cloth-project','tearable%20cloth%20project/app.js','tear_arti_app.js'],['artimoradi1382-design/tearable-cloth-project','tearable%20cloth%20project/style.css','tear_arti.css']];
const dir='D:/deepseek/gouzuoqu/U/.tmp-test/gh'; fs.mkdirSync(dir,{recursive:true});
(async()=>{for(const [repo,p,out] of items){
  const url='https://api.github.com/repos/'+repo+'/contents/'+p;
  const r=await fetch(url,{headers:{'user-agent':'u-app',accept:'application/vnd.github.raw'}});
  if(!r.ok){console.log('FAIL',out,r.status);continue;}
  const buf=Buffer.from(await r.arrayBuffer()); fs.writeFileSync(path.join(dir,out),buf);
  console.log('OK',out,buf.length);
}})();