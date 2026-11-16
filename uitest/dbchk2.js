const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync('D:/deepseek/gouzuoqu/U/11111/data/u.db',{readOnly:true}); db.exec('PRAGMA busy_timeout=4000');
console.log('P1166', JSON.stringify(db.prepare('SELECT id,user_id,text,private,sensitive,created_at FROM posts WHERE id IN (1166,1167)').all()));
console.log('M1166', JSON.stringify(db.prepare('SELECT id,mime,size,poster,ratio,post_id FROM media WHERE post_id IN (1166,1167)').all()));
console.log('MULTI', JSON.stringify(db.prepare("SELECT post_id, COUNT(*) n FROM media WHERE post_id IS NOT NULL AND post_id>1100 GROUP BY post_id HAVING n>2 ORDER BY post_id DESC").all()));
console.log('USERS', JSON.stringify(db.prepare('SELECT id,username,nickname,is_admin,is_bot,is_guest FROM users WHERE id IN (1,307,316)').all()));
console.log('LOGS', JSON.stringify(db.prepare("SELECT id,text FROM logs WHERE text LIKE '%发帖%' ORDER BY id DESC LIMIT 6").all()).slice(0,600));