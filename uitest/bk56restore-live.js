
const fs = require('fs'); const path = require('path');
const B = 'http://127.0.0.1:8787';
(async () => {
  const out = {};
  const lr = await fetch(B + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin123', password: 'admin123' }) });
  const ld = await lr.json(); const H = { authorization: 'Bearer ' + ld.token, 'content-type': 'application/json' };
  const before = await (await fetch(B + '/api/posts', { headers: H })).json();
  out.beforePosts = (before.items || before.posts || []).length;
  const rr = await fetch(B + '/api/admin/data/restore', { method: 'POST', headers: H, body: JSON.stringify({}) });
  out.restoreStatus = rr.status;
  out.restore = await rr.json().catch(() => null);
  const after = await (await fetch(B + '/api/posts', { headers: { authorization: 'Bearer ' + ((out.restore && out.restore.token) || ld.token) } })).json();
  out.afterPosts = (after.items || after.posts || []).length;
  out.mediaDir = fs.readdirSync('D:/deepseek/gouzuoqu/U/11111/data/media').length;
  const bk = await (await fetch(B + '/api/admin/backups', { headers: H })).json();
  out.backups = (bk.items || []).map(i => i.name + '/' + i.size);
  console.log(JSON.stringify(out, null, 1));
})();
