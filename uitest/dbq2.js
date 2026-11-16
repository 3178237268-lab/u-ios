
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('D:/deepseek/gouzuoqu/U/11111/data/u.db', { readOnly: true });
console.log(JSON.stringify(db.prepare('SELECT id, filename, mime, size, poster, ratio FROM media WHERE id = ?').get('ac987b17257960abcf6d3331')));
const rows = db.prepare('SELECT id, filename, mime, size, poster FROM media WHERE post_id = 1124 ORDER BY rowid').all();
for (const r of rows) console.log(JSON.stringify(r));
