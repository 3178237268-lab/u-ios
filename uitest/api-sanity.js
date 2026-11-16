
const API = 'http://127.0.0.1:8787';
(async () => {
  const login = await (await fetch(API + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin123', password: 'admin123' }) })).json();
  const h = { authorization: 'Bearer ' + login.token };
  const m = await (await fetch(API + '/api/admin/media?limit=5', { headers: h })).json();
  const u = await (await fetch(API + '/api/admin/users?role=admin', { headers: h })).json();
  const cfg = await (await fetch(API + '/api/config')).json();
  console.log(JSON.stringify({ media: (m.items || []).length, mediaTotal: m.total, users: (u.users || []).length, usersTotal: u.total, botEngine: cfg.settings && cfg.settings.botPostEverySec }));
})().catch((e) => console.log(JSON.stringify({ fatal: String(e).slice(0, 120) })));
