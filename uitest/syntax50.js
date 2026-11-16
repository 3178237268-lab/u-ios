
const fs=require('fs');const vm=require('vm');
const html=fs.readFileSync('index.html','utf8');
const re=/<script(?![^>]*type="text\/plain")[^>]*>([\s\S]*?)<\/script>/g;let m,i=0,bad=0;
while((m=re.exec(html))){i++;try{new vm.Script(m[1]);}catch(err){console.log('block',i,'len',m[1].length,'ERR',err.message.slice(0,70));bad++;}}
console.log('blocks',i,'bad',bad);
