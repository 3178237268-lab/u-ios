const fs=require('fs'),path=require('path');
const {DatabaseSync}=require('node:sqlite');
const MEDIA='D:/deepseek/gouzuoqu/U/11111/data/media';
const db=new DatabaseSync('D:/deepseek/gouzuoqu/U/11111/data/u.db');
db.exec('PRAGMA busy_timeout=6000');
const rows=db.prepare('SELECT id,poster,post_id,mime,size FROM media').all();
const refd=new Set(rows.map(r=>r.poster).filter(Boolean));
function bad(p){try{const fd=fs.openSync(path.join(MEDIA,p),'r');const b=Buffer.alloc(4);fs.readSync(fd,b,0,4,0);fs.closeSync(fd);return !(b[0]===0xff&&b[1]===0xd8)&&!(b[0]===0x89&&b[1]===0x50);}catch(e){return false;}}
const victims=rows.filter(r=>bad(r.id)&&!refd.has(r.id));
console.log('corrupt-orphans',victims.length, victims.map(v=>v.id).join(' '));
const del=db.prepare('DELETE FROM media WHERE id=?');
for(const v of victims){ try{del.run(v.id);}catch(e){console.log('del fail',v.id,e.message);} try{fs.unlinkSync(path.join(MEDIA,v.id));}catch(e){} }
const after=db.prepare('SELECT COUNT(*) c FROM media').get();
console.log('media rows after', after.c);
