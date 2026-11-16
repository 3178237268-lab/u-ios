
const fs=require('fs');const path=require('path');
const { DatabaseSync } = require('node:sqlite');
const db=new DatabaseSync('D:/deepseek/gouzuoqu/U/11111/data/u.db',{readOnly:true});
const rows=db.prepare("select id,size from media where mime like 'video/%' order by size desc limit 6").all();
console.log('videos', rows.map(r=>r.id+':'+r.size).join(' '));
const out='D:/deepseek/gouzuoqu/U/.tmp-test/e2e';
fs.mkdirSync(out,{recursive:true});
let i=1;
for(const r of rows){ fs.copyFileSync('D:/deepseek/gouzuoqu/U/11111/data/media/'+r.id, path.join(out,'v'+(i++)+'.mp4')); }
console.log('copied', i-1, fs.readdirSync(out).map(n=>n+':'+Math.round(fs.statSync(path.join(out,n)).size/1048576*10)/10+'MB').join(' '));
