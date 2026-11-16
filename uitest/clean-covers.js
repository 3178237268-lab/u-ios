
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const db = new DatabaseSync('C:/Users/YeKi8/Desktop/11111/data/u.db');
const rows = db.prepare("SELECT id FROM media WHERE mime = 'image/jpeg' AND filename = 'cover.jpg' AND post_id IS NULL AND id NOT IN (SELECT poster FROM media WHERE poster IS NOT NULL AND poster <> '')").all();
for (const r of rows) { try { fs.unlinkSync('C:/Users/YeKi8/Desktop/11111/data/media/' + r.id); } catch (e) {} }
db.exec("DELETE FROM media WHERE mime = 'image/jpeg' AND filename = 'cover.jpg' AND post_id IS NULL AND id NOT IN (SELECT poster FROM media WHERE poster IS NOT NULL AND poster <> '')");
console.log(JSON.stringify({ removed: rows.length }));
db.close();
