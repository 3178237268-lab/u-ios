
const API = 'http://127.0.0.1:8787';
(async () => {
  const login = await (await fetch(API + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin123', password: 'admin123' }) })).json();
  const r = await fetch(API + '/api/admin/media?limit=3', { headers: { authorization: 'Bearer ' + login.token } });
  const t = await r.text();
  console.log(t.slice(0, 400));
})().catch((e) => console.log(String(e).slice(0, 120)));
