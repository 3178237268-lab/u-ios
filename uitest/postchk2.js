const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('D:/deepseek/gouzuoqu/U/11111/data/u.db',{readOnly:true});
const rows=db.prepare("SELECT p.id,p.user_id,p.text,p.sensitive,p.created_at,(SELECT COUNT(*) FROM media m WHERE m.post_id=p.id) n FROM posts p ORDER BY p.id DESC LIMIT 40").all();
console.log(JSON.stringify(rows.filter(r=>r.n===0&&r.text==='')));
console.log('total posts', db.prepare('SELECT COUNT(*) c FROM posts').get().c, 'media', db.prepare('SELECT COUNT(*) c FROM media').get().c);
