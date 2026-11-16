const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('D:/deepseek/gouzuoqu/U/11111/data/u.db', { readOnly: true });
const rows = db.prepare("SELECT id, post_id, mime, size, poster, ratio FROM media WHERE mime LIKE 'video/%' ORDER BY post_id DESC, id").all();
console.log('videos=' + rows.length);
for (const r of rows) console.log([r.post_id, r.id.slice(0, 10), (r.size/1048576).toFixed(1) + 'MB', r.poster ? 'poster:' + r.poster.slice(0,10) : 'NO-POSTER', 'ratio=' + r.ratio].join(' '));
const posts = db.prepare("SELECT p.id, u.username, u.is_admin, u.is_bot, p.created_at, (SELECT COUNT(*) FROM media m WHERE m.post_id = p.id) n FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id IN (SELECT DISTINCT post_id FROM media WHERE mime LIKE 'video/%' AND post_id IS NOT NULL) ORDER BY p.id DESC LIMIT 12").all();
console.log('--- posts ---');
for (const p of posts) console.log(JSON.stringify(p));