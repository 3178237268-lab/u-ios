const fs=require('fs'),path=require('path');
const dir='D:/$RECYCLE.BIN/S-1-5-21-3941977200-1094376050-1102585094-1001';
const files=fs.readdirSync(dir).filter(f=>f.startsWith('$I'));
let hits=[];
for(const f of files){
  let b; try{b=fs.readFileSync(path.join(dir,f));}catch(e){continue;}
  const s=b.toString('utf16le');
  if(/media|gouzuoqu|u\.db/i.test(s)){
    const size=b.readBigInt64LE(8);
    const rn='$R'+f.slice(2);
    hits.push({i:f, r:rn, size:Number(size), path:s.replace(/\0/g,'').slice(0,160)});
  }
}
console.log('hits',hits.length);
hits.slice(0,40).forEach(h=>console.log(h.r, h.size, h.path));
