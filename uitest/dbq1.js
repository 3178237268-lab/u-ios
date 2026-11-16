
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('D:/deepseek/gouzuoqu/U/11111/data/u.db',{readOnly:true});
console.log(JSON.stringify(db.prepare('SELECT id,user_id,text,private,sensitive,created_at FROM posts WHERE id IN (1136,1137,1138,1120,184)').all()));
try{
 const rows=db.prepare("SELECT id,type,detail,created_at FROM logs WHERE detail LIKE '%#1138%' OR detail LIKE '%#1137%' ORDER BY id DESC LIMIT 6").all();
 console.log(JSON.stringify(rows));
}catch(e){console.log('logs err',e.message);}
console.log(JSON.stringify(db.prepare("SELECT id,post_id,poster,ratio,size,mime FROM media WHERE post_id IN (1137,1138)").all()).slice(0,1200));
