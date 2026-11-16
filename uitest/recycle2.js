const fs=require('fs'),path=require('path');
const dir='D:/$RECYCLE.BIN/S-1-5-21-3941977200-1094376050-1102585094-1001';
const files=fs.readdirSync(dir).filter(f=>f.startsWith('$I'));
let hits=[];
for(const f of files){
  let b; try{b=fs.readFileSync(path.join(dir,f));}catch(e){continue;}
  const s=b.toString('utf16le');
  if(/data.media|\\media\\/i.test(s)){
    const size=Number(b.readBigInt64LE(8));
    hits.push({r:'$R'+f.slice(2), size:size, path:s.replace(/\0/g,'').replace(/[^\x20-\x7e:\\]/g,'').slice(0,140)});
  }
}
hits.sort((a,b)=>b.size-a.size);
console.log('media hits',hits.length);
hits.slice(0,25).forEach(h=>console.log(h.r, (h.size/1048576).toFixed(1)+'MB', h.path));
