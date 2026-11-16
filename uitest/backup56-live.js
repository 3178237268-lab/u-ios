
const fs = require('fs'); const path = require('path');
const B = 'http://127.0.0.1:8787';
(async () => {
  const lr = await fetch(B + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin123', password: 'admin123' }) });
  const ld = await lr.json();
  const token = ld.token || (ld.user && ld.user.token) || '';
  const H = { authorization: 'Bearer ' + token };
  const info = await (await fetch(B + '/api/admin/backup', { headers: H })).json();
  const list = await (await fetch(B + '/api/admin/backups', { headers: H })).json();
  const dir = path.join('D:/deepseek/gouzuoqu/U/11111/data/backup');
  const names = fs.readdirSync(dir);
  const dirs = names.filter(n => { try { return fs.statSync(path.join(dir, n)).isDirectory(); } catch(e) { return false; } });
  const contents = dirs.map(d => ({ d, files: fs.readdirSync(path.join(dir, d)).sort(), media: (function(){ try { return fs.readdirSync(path.join(dir, d, 'media')).length; } catch(e) { return -1; } })(), meta: (function(){ try { return JSON.parse(fs.readFileSync(path.join(dir, d, 'meta.json'), 'utf8')); } catch(e) { return null; } })() }));
  const mediaCount = fs.readdirSync('D:/deepseek/gouzuoqu/U/11111/data/media').length;
  console.log(JSON.stringify({ backup: info.backup, items: (list.items||[]).map(i => ({ name: i.name, size: i.size, kind: i.kind, mediaFiles: i.mediaFiles, legacy: i.legacy, counts: i.counts && { posts: i.counts.posts, users: i.counts.users, comments: i.counts.comments } })), dirs, contents, mediaCount }, null, 1));
})();
