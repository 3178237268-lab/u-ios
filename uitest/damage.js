const fs=require('fs'),path=require('path');
const {DatabaseSync}=require('node:sqlite');
const MEDIA='D:/deepseek/gouzuoqu/U/11111/data/media';
const files=fs.readdirSync(MEDIA);
console.log('files on disk',files.length);
const db=new DatabaseSync('D:/deepseek/gouzuoqu/U/11111/data/u.db',{readOnly:true});
const rows=db.prepare('SELECT id,post_id,mime,size FROM media').all();
console.log('rows',rows.length);
const byPost={};
for(const p of [1120,1137,1138,184]){byPost[p]=rows.filter(r=>r.post_id===p).length;}
console.log('per post',JSON.stringify(byPost));
const miss=rows.filter(r=>!fs.existsSync(path.join(MEDIA,r.id)));
console.log('rows missing file',miss.length);
console.log('files not in rows',files.filter(f=>!rows.some(r=>r.id===f)).length);
