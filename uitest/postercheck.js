const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('D:/deepseek/gouzuoqu/U/11111/data/u.db', { readOnly: true });
const rows = db.prepare("SELECT id, post_id, poster, size FROM media WHERE mime LIKE 'video/%' ORDER BY post_id DESC, id").all();
const posters = db.prepare("SELECT id, mime, size FROM media WHERE id IN (SELECT poster FROM media WHERE poster IS NOT NULL AND poster <> '')").all();
const map = new Map(posters.map((p) => [p.id, p]));
(async () => {
  for (const r of rows) {
    const p = map.get(r.poster);
    let http = 'n/a';
    if (p) {
      const res = await fetch('http://127.0.0.1:8787/media/' + r.poster, { method: 'GET' });
      const buf = await res.arrayBuffer();
      http = res.status + ' ' + res.headers.get('content-type') + ' ' + buf.byteLength + 'B';
    }
    console.log([r.post_id, r.id.slice(0, 8), r.poster ? 'p:' + r.poster.slice(0, 8) : 'none', p ? p.mime + ' ' + p.size + 'B' : 'POSTER-ROW-MISSING', http].join(' | '));
  }
})();