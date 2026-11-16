
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = 'D:/deepseek/gouzuoqu/U';
const TEMP = path.join(ROOT, '.tmp-test', 'bk56');
const PORT = 18961;
const B = 'http://127.0.0.1:' + PORT;
function rm(p){ try { fs.rmSync(p, { recursive: true, force: true }); } catch(e){} }
function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }
async function api(p, opt){
  const o = Object.assign({ headers: { 'content-type': 'application/json' } }, opt || {});
  if (o.body && typeof o.body !== 'string') o.body = JSON.stringify(o.body);
  const r = await fetch(B + p, o);
  let d = null;
  try { d = await r.json(); } catch(e) { d = null; }
  return { status: r.status, d };
}
(async () => {
  rm(TEMP);
  fs.mkdirSync(TEMP, { recursive: true });
  const child = spawn(process.execPath, [path.join(ROOT, 'server/src/server.js')], {
    env: Object.assign({}, process.env, { PORT: String(PORT), HOST: '127.0.0.1', U_DISCOVER_PORT: '18761', U_DATA_DIR: TEMP, ADMIN_USER: 'admin123', ADMIN_PASS: 'admin123' }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let boot = '';
  child.stdout.on('data', b => { boot += b.toString(); });
  child.stderr.on('data', b => { boot += b.toString(); });
  const out = { errs: [] };
  try {
    let up = false;
    for (let i = 0; i < 40; i++) { const r = await api('/api/config').catch(()=>null); if (r && r.status === 200) { up = true; break; } await wait(500); }
    out.up = up;
    if (!up) throw new Error('server not up: ' + boot.slice(-300));
    const login = await api('/api/login', { method: 'POST', body: { username: 'admin123', password: 'admin123' } });
    out.login = login.status;
    const token = (login.d && (login.d.token || (login.d.user && login.d.user.token))) || '';
    const H = { 'content-type': 'application/json', 'x-token': token, authorization: 'Bearer ' + token };

    const mediaDir = path.join(TEMP, 'media');
    fs.mkdirSync(mediaDir, { recursive: true });
    fs.writeFileSync(path.join(mediaDir, 'aaa1'), Buffer.alloc(4096, 7));
    fs.writeFileSync(path.join(mediaDir, 'bbb2'), Buffer.alloc(2048, 9));

    const b1 = await api('/api/admin/backup', { method: 'POST', headers: H, body: {} });
    out.backup1 = { status: b1.status, name: b1.d && b1.d.name, size: b1.d && b1.d.size, mediaFiles: b1.d && b1.d.mediaFiles, counts: b1.d && b1.d.counts };
    const dir1 = path.join(TEMP, 'backup', (b1.d && b1.d.name) || '');
    out.files1 = fs.existsSync(dir1) ? fs.readdirSync(dir1).sort() : null;
    out.mediaCopy = fs.existsSync(path.join(dir1, 'media')) ? fs.readdirSync(path.join(dir1, 'media')).sort() : null;

    const info = await api('/api/admin/backup', { headers: H });
    out.info = { status: info.status, exists: info.d && info.d.backup && info.d.backup.exists, name: info.d && info.d.backup && info.d.backup.name, mediaFiles: info.d && info.d.backup && info.d.backup.mediaFiles, bytes: info.d && info.d.backup && info.d.backup.bytes, counts: info.d && info.d.backup && info.d.backup.counts };

    const list1 = await api('/api/admin/backups', { headers: H });
    out.list1 = (list1.d && list1.d.items || []).map(it => ({ name: it.name, size: it.size, kind: it.kind, mediaFiles: it.mediaFiles, legacy: it.legacy }));

    await api('/api/admin/settings', { method: 'POST', headers: H, body: { backupKeep: 1 } });
    const b2 = await api('/api/admin/backup', { method: 'POST', headers: H, body: {} });
    out.backup2 = b2.status;
    const dirs = fs.readdirSync(path.join(TEMP, 'backup')).filter(n => { try { return fs.statSync(path.join(TEMP, 'backup', n)).isDirectory(); } catch(e) { return false; } });
    out.dirsAfterKeep1 = dirs.length;

    const rs = await api('/api/admin/data/restore', { method: 'POST', headers: H, body: { name: (b2.d && b2.d.name) || '' } });
    out.restore = { status: rs.status, name: rs.d && rs.d.name, mediaFiles: rs.d && rs.d.mediaFiles, counts: rs.d && rs.d.counts };
    out.mediaAfterRestore = fs.readdirSync(mediaDir).sort();

    const bad = await api('/api/admin/data/restore', { method: 'POST', headers: H, body: { name: 'nope-123' } });
    out.restoreBad = { status: bad.status, error: bad.d && bad.d.error };

    const del = await api('/api/admin/backups', { method: 'DELETE', headers: H, body: { name: (b2.d && b2.d.name) || '' } });
    out.del = del.status;
    const list2 = await api('/api/admin/backups', { headers: H });
    out.left = (list2.d && list2.d.items || []).length;
  } catch (e) {
    out.errs.push(String(e.message || e).slice(0, 200));
  } finally {
    try { child.kill(); } catch (e) {}
    await wait(600);
    console.log(JSON.stringify(out, null, 1));
  }
})();
