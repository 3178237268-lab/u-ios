const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const db = new DatabaseSync('D:/deepseek/gouzuoqu/U/11111/data/u.db', { readOnly: true });
const rows = db.prepare("SELECT post_id, id, poster FROM media WHERE mime LIKE 'video/%' AND poster IS NOT NULL ORDER BY post_id DESC, id").all();
fs.writeFileSync('D:/deepseek/gouzuoqu/U/uitest/poster-ids.json', JSON.stringify(rows.map((r) => [r.poster, r.post_id, r.id])));
console.log('wrote ' + rows.length);