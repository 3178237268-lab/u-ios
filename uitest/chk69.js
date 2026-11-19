const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync('D:/deepseek/gouzuoqu/U/index.html','utf8');
const re=/<script(?![^>]*src=)([^>]*)>([\s\S]*?)<\/script>/g;let m,i=0,bad=0;
while((m=re.exec(html))){ if(/type="text\/plain"/.test(m[1]))continue; i++; const code=m[2];
 try{ new vm.Script(code,{filename:'block'+i}); console.log('block'+i+' ok chars='+code.length);}catch(e){bad++;console.log('block'+i+' FAIL '+e.message);} }
console.log('blocks='+i+' bad='+bad);