
const {spawn}=require('child_process');const path=require('path'),fs=require('fs');
const ROOT='D:/deepseek/gouzuoqu/U';
fs.rmSync(path.join(ROOT,'uitest/patch-data'),{recursive:true,force:true});
const srv=spawn(process.execPath,[path.join(ROOT,'server/src/server.js')],{cwd:path.join(ROOT,'server'),env:{...process.env,PORT:'18950',U_DISCOVER_PORT:'18765',U_DATA_DIR:path.join(ROOT,'uitest/patch-data')},stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await sleep(3000);
  const reg=await (await fetch('http://127.0.0.1:18950/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'p1',password:'123456'})})).json();
  const H={'content-type':'application/json',authorization:'Bearer '+reg.token};
  const c=await fetch('http://127.0.0.1:18950/api/posts',{method:'POST',headers:H,body:JSON.stringify({text:'hello'})});
  console.log('create',c.status,(await c.text()).slice(0,120));
  const p=await fetch('http://127.0.0.1:18950/api/posts/1',{method:'PATCH',headers:H,body:JSON.stringify({sensitive:true,private:false,text:'hello2'})});
  console.log('patch',p.status,(await p.text()).slice(0,200));
  const g=await (await fetch('http://127.0.0.1:18950/api/posts?limit=5')).json();
  console.log('post',JSON.stringify((g.posts||[]).map(x=>({id:x.id,sens:x.sensitive,text:x.text}))));
  srv.kill(); process.exit(0);
})().catch(e=>{console.error('FATAL',e.message);srv.kill();process.exit(1);});
