const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('D:/deepseek/gouzuoqu/U/11111/data/u.db',{readOnly:true});
for(const id of [184,1120]){
  const p=db.prepare('SELECT id,user_id,text,private,sensitive,created_at FROM posts WHERE id=?').get(id);
  const mm=db.prepare('SELECT COUNT(*) c FROM media WHERE post_id=?').get(id);
  console.log(id, JSON.stringify(p).slice(0,200), 'media', mm.c);
}
const left=db.prepare('SELECT post_id,COUNT(*) c FROM media WHERE post_id IS NOT NULL GROUP BY post_id').all();
console.log('posts with media', JSON.stringify(left));
