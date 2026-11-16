
const fs=require('fs'), path=require('path');
const { DatabaseSync } = require('node:sqlite');
const DIR='D:/deepseek/gouzuoqu/U/11111/data/media';
const db=new DatabaseSync('D:/deepseek/gouzuoqu/U/11111/data/u.db',{readOnly:true});
const rows=db.prepare('select id,mime,size,poster from media').all();
const ids=new Set(rows.map(r=>r.id));
const posters=new Set(rows.map(r=>r.poster).filter(Boolean).map(p=>String(p).replace(/^\/media\//,'')));
const files=fs.readdirSync(DIR);
const orphanFiles=files.filter(f=>!ids.has(f) && !posters.has(f));
const missing=rows.filter(r=>!files.includes(r.id)).map(r=>({id:r.id,mime:r.mime,size:r.size}));
const orphanBytes=orphanFiles.reduce((a,f)=>{ try { return a+fs.statSync(path.join(DIR,f)).size; } catch(e){ return a; } },0);
const referencedMissingPosters=rows.filter(r=>r.poster && !files.includes(String(r.poster).replace(/^\/media\//,''))).map(r=>({id:r.id,poster:r.poster}));
console.log(JSON.stringify({files:files.length, rows:rows.length, orphanFiles:orphanFiles.length, orphanMB:+(orphanBytes/1048576).toFixed(1), orphanSample:orphanFiles.slice(0,5), missing:missing.length, missingSample:missing.slice(0,5), badPosters:referencedMissingPosters.length},null,1));
const posts=db.prepare('select id from posts').all().length;
console.log('posts rows', posts);
