const fs=require('fs'),path=require('path');
const dir='D:/deepseek/gouzuoqu/U/11111/data/media';
const files=fs.readdirSync(dir);
let bad=[],jpg=0,png=0,other=0,small=[];
for(const f of files){
  const full=path.join(dir,f); let st; try{st=fs.statSync(full);}catch(e){continue;}
  if(st.size>3*1024*1024){other++;continue;}
  const fd=fs.openSync(full,'r'); const b=Buffer.alloc(16); fs.readSync(fd,b,0,16,0); fs.closeSync(fd);
  const h=b.toString('latin1');
  if(h.startsWith('\xff\xd8\xff')) jpg++;
  else if(h.startsWith('\x89PNG')) png++;
  else { bad.push([f, st.size, JSON.stringify(h.slice(0,12))]); }
}
console.log('total',files.length,'jpg',jpg,'png',png,'bad',bad.length);
console.log(bad.slice(0,15).map(x=>x.join(' ')).join('\n'));
