const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync('D:/deepseek/gouzuoqu/U/11111/data/u.db',{readOnly:true});
db.exec('PRAGMA busy_timeout=4000');
const rows=db.prepare("SELECT p.id,p.created_at,p.user_id,COUNT(m.id) n,SUM(CASE WHEN m.poster IS NULL OR m.poster='' THEN 1 ELSE 0 END) noposter FROM posts p LEFT JOIN media m ON m.post_id=p.id GROUP BY p.id ORDER BY p.id DESC LIMIT 8").all();
console.log(JSON.stringify(rows));
const med=db.prepare("SELECT id,post_id,mime,size,poster,ratio FROM media WHERE post_id IS NOT NULL ORDER BY id DESC LIMIT 14").all();
console.log(JSON.stringify(med));