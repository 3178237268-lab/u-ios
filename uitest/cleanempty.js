const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('D:/deepseek/gouzuoqu/U/11111/data/u.db');
db.exec('PRAGMA busy_timeout=6000');
for(const id of [1120,1137,1138]){
  const n=db.prepare('SELECT COUNT(*) c FROM media WHERE post_id=?').get(id).c;
  const t=db.prepare('SELECT text FROM posts WHERE id=?').get(id);
  if(n===0 && (!t || !t.text)){ db.prepare('DELETE FROM posts WHERE id=?').run(id); console.log('deleted empty post',id); }
  else console.log('kept',id,n,JSON.stringify(t));
}
console.log('posts', db.prepare('SELECT COUNT(*) c FROM posts').get().c);
