
const fs=require('fs');const vm=require('vm');
const html=fs.readFileSync('index.html','utf8');
const parts=html.split(/<script\b/);let idx=0;
parts.forEach((p,i)=>{ if(i===0) return; const body=p.slice(p.indexOf('>')+1); const code=body.split(/<\/script>/)[0]; if(code.length<200) return; try{new vm.Script(code);console.log('block',i,'len',code.length,'ok');}catch(e){console.log('block',i,'len',code.length,'ERR',e.message.slice(0,60));} });
