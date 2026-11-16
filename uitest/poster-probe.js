
const { DatabaseSync } = require('node:sqlite');
const API = 'http://127.0.0.1:8787';
const VID = '23a16b41ae999fc3c6a9a18d';
(async () => {
  const login = await (await fetch(API + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }) })).json();
  const tok = login.token;
  const jpg = Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPDcxNDH/wAALCAAIAAgBAREA/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/APn+v//Z', 'base64');
  const up = await fetch(API + '/api/media/' + VID + '/poster', { method: 'POST', headers: { authorization: 'Bearer ' + tok, 'content-type': 'image/jpeg', 'x-ratio': '1.77' }, body: jpg });
  const upTxt = await up.text();
  const db = new DatabaseSync('C:/Users/YeKi8/Desktop/11111/data/u.db');
  const row = db.prepare('SELECT id, poster, ratio FROM media WHERE id = ?').get(VID);
  const api = await (await fetch(API + '/api/posts?limit=30')).json();
  const posts = api.posts || [];
  const hit = [];
  for (const p of posts) for (const m of (p.media || [])) if (m.id === VID) hit.push({ poster: m.poster, ratio: m.ratio });
  console.log(JSON.stringify({ up: up.status, upTxt: upTxt.slice(0, 80), row, hit }));
  db.close();
})().catch((e) => console.log(JSON.stringify({ fatal: String(e).slice(0, 200) })));
