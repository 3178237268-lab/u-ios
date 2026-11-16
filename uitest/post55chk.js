const fs=require('fs'),path=require('path');
const {DatabaseSync}=require('node:sqlite');
const MEDIA='D:/deepseek/gouzuoqu/U/11111/data/media';
const db=new DatabaseSync('D:/deepseek/gouzuoqu/U/11111/data/u.db',{readOnly:true});
const p=db.prepare("SELECT id,text,created_at FROM posts ORDER BY id DESC LIMIT 3").all();
console.log('posts',JSON.stringify(p));
const newest=p[0].id;
const ms=db.prepare('SELECT id,mime,size,poster,ratio FROM media WHERE post_id=?').all(newest);
for(const m of ms){
  const f=path.join(MEDIA,m.poster||'');
  let head='-',sz=0;
  try{const b=fs.readFileSync(f);head=b.slice(0,3).toString('hex');sz=b.length;}catch(e){head='MISS';}
  console.log(m.id.slice(0,8),m.mime,m.size,'poster',(m.poster||'').slice(0,10),'file',head,sz);
}
