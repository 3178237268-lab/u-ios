
const B = 'http://127.0.0.1:8787';
(async () => {
  const ld = await (await fetch(B + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin123', password: 'admin123' }) })).json();
  const H = { authorization: 'Bearer ' + ld.token };
  const bk = await (await fetch(B + '/api/admin/backups', { headers: H })).json();
  const info = await (await fetch(B + '/api/admin/backup', { headers: H })).json();
  const cfg = await (await fetch(B + '/api/config')).json();
  console.log(JSON.stringify({ items: (bk.items||[]).map(i => [i.name, i.size, i.kind, i.legacy, i.mediaFiles]), dir: bk.dir, info: { name: info.backup.name, bytes: info.backup.bytes, mediaFiles: info.backup.mediaFiles }, mediaMax: cfg.settings && cfg.settings.mediaMaxPerPost }, null, 1));
})();
