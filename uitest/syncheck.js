const fs=require('fs'),vm=require('vm'); const h=fs.readFileSync('D:/deepseek/gouzuoqu/U/index.html','utf8');
const re=/<script([^>]*)>([\s\S]*?)<\/script>/g; let m,i=0;
while((m=re.exec(h))){ i++; if(m[1].includes('src=')||m[1].includes('type="text/plain"')) continue; try{ new vm.Script(m[2]); }catch(e){ console.log('BLOCK',i,'ERR',e.message.slice(0,90)); } }
console.log('blocks scanned',i);