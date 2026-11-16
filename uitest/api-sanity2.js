
const API = 'http://127.0.0.1:8787';
(async () => {
  const login = await (await fetch(API + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin123', password: 'admin123' }) })).json();
  const h = { authorization: 'Bearer ' + login.token };
  const out = {};
  for (const q of ['', '?role=admin', '?role=user', '?role=bot', '?role=guest', '?role=admin&limit=5']) {
    const m = await (await fetch(API + '/api/admin/media' + q, { headers: h })).json();
    out[q || 'none'] = { items: (m.items || []).length, total: m.total, first: (m.items || [])[0] && (m.items[0].mime || '') };
  }
  console.log(JSON.stringify(out));
})().catch((e) => console.log(JSON.stringify({ fatal: String(e).slice(0, 120) })));
