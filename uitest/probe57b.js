
const { DatabaseSync } = require('node:sqlite');
const B='http://127.0.0.1:8787';
(async()=>{
  const posts=await (await fetch(B+'/api/posts?limit=100')).json();
  const items=posts.items||posts.posts||[];
  for (const id of [1169,1166]) {
    const p=items.find(x=>x.id===id);
    console.log('--- post', id, JSON.stringify((p&&p.media)||[]).slice(0,900));
  }
  const db=new DatabaseSync('D:/deepseek/gouzuoqu/U/11111/data/u.db',{readOnly:true});
  console.log('--- schema', JSON.stringify(db.prepare("select sql from sqlite_master where name='media'").get()));
  console.log('--- rows', JSON.stringify(db.prepare("select id,kind,mime,poster_id,post_id,bytes,length,width,height from media order by rowid desc limit 8").all()));
  console.log('--- counts', JSON.stringify(db.prepare("select kind,count(*) c from media group by kind").all()));
})();
