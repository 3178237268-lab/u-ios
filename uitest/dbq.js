
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('D:/deepseek/gouzuoqu/U/11111/data/u.db', { readOnly: true });
const ids = ['4260c21df103f8c228611c17','5a8ffad5e1bb9fd614b7d843','a1e850f3efdb702424add82f','a5bb8020dd55fdbffb696caf','09c228c403c2b9024c74896b','735817f85c4b41562e4d1b55'];
for (const id of ids) {
  const r = db.prepare('SELECT id, filename, mime, size, poster, ratio, post_id FROM media WHERE id = ?').get(id);
  console.log(JSON.stringify(r));
}
