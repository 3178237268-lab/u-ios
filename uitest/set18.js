
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('D:/deepseek/gouzuoqu/U/11111/data/u.db');
db.exec('PRAGMA busy_timeout=5000');
const r=db.prepare('UPDATE posts SET sensitive = 1 WHERE id IN (1137,1138) AND user_id = 1').run();
console.log('updated', r.changes);
db.close();
