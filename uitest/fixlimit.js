
(async () => {
  const cfg = await fetch('http://127.0.0.1:8787/api/config').then(r => r.json());
  console.log('cfg mediaMaxPerPost =', cfg.mediaMaxPerPost, ' videoMB', cfg.uploadVideoMB);
  const login = await fetch('http://127.0.0.1:8787/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin123', password: 'admin123' }) }).then(r => r.json());
  const res = await fetch('http://127.0.0.1:8787/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.token }, body: JSON.stringify({ mediaMaxPerPost: 9 }) });
  console.log('save', res.status, JSON.stringify(await res.json().catch(() => ({}))).slice(0, 200));
  const cfg2 = await fetch('http://127.0.0.1:8787/api/config').then(r => r.json());
  console.log('after =', cfg2.mediaMaxPerPost);
})();
