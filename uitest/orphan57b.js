
const fs=require('fs'), path=require('path');
const { DatabaseSync } = require('node:sqlite');
const DIR='D:/deepseek/gouzuoqu/U/11111/data/media';
const db=new DatabaseSync('D:/deepseek/gouzuoqu/U/11111/data/u.db',{readOnly:true});
const rows=db.prepare('select id,poster from media').all();
const ids=new Set(rows.map(r=>r.id));
const posters=new Set(rows.map(r=>r.poster).filter(Boolean).map(p=>String(p).replace(/^\/media\//,'')));
const files=fs.readdirSync(DIR);
const orphanFiles=files.filter(f=>!ids.has(f) && !posters.has(f));
const orphanRows=rows.filter(r=>!files.includes(r.id) && !posters.has(r.id)).map(r=>r.id);
console.log(JSON.stringify({files:files.length, rows:rows.length, orphanFiles, orphanRows}));
fs.writeFileSync('D:/deepseek/gouzuoqu/U/.tmp-test/orphan57.json', JSON.stringify({orphanFiles, orphanRows}));
