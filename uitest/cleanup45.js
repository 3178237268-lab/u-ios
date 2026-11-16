
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const dir = 'D:/deepseek/gouzuoqu/U/11111/data';
const db = new DatabaseSync(path.join(dir, 'u.db'));
const id = '4260c21df103f8c228611c17';
const used = db.prepare('SELECT COUNT(*) c FROM media WHERE poster = ?').get(id).c;
console.log('referenced as poster by', used);
if (!used) {
  const row = db.prepare('SELECT post_id FROM media WHERE id = ?').get(id);
  console.log('row', JSON.stringify(row));
  if (!row || !row.post_id) {
    db.exec("DELETE FROM media WHERE id = '" + id + "'");
    const f = path.join(dir, 'media', id);
    if (fs.existsSync(f)) { fs.unlinkSync(f); console.log('file removed'); }
  }
}
(async () => {
  const cfg = await fetch('http://127.0.0.1:8787/api/config').then(r => r.json());
  const posts = await fetch('http://127.0.0.1:8787/api/posts?limit=50').then(r => r.json());
  const list = posts.posts || posts;
  const hevc = [];
  (Array.isArray(list) ? list : []).forEach(p => (p.media || []).forEach(m => {
    if (m.id === 'srvm_ac987b17257960abcf6d3331') hevc.push({ poster: m.poster });
    if (['srvm_7bb969a44cb98bc2bd09bbf6','srvm_7fd0ea0592f3a03ead8660e1','srvm_898b8e5fd033f4608f31caec'].includes(m.id)) hevc.push({ id: m.id, poster: m.poster });
  }));
  console.log('limit', cfg.mediaMaxPerPost);
  console.log(JSON.stringify(hevc));
  const html = await fetch('http://127.0.0.1:8765/index.html').then(r => r.text());
  console.log('gradient in live page:', html.includes('linear-gradient(152deg,#242c44'), 'nodecode:', html.includes('nodecode'), 'noDecode guard:', html.includes('noDecode'));
})();
