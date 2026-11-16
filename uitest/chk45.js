
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('D:/deepseek/gouzuoqu/U/index.html', 'utf8');
const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
let m, i = 0;
while ((m = re.exec(html))) {
  i++;
  try { new vm.Script(m[1]); }
  catch (e) { console.log('block', i, 'len', m[1].length, 'ERR', e.message); continue; }
  console.log('block', i, 'len', m[1].length, 'ok');
}
const db = new (require('node:sqlite').DatabaseSync)('D:/deepseek/gouzuoqu/U/11111/data/u.db');
db.exec("UPDATE media SET poster = NULL WHERE id = 'ac987b17257960abcf6d3331'");
console.log('media poster cleared:', JSON.stringify(db.prepare("SELECT id, poster FROM media WHERE id='ac987b17257960abcf6d3331'").get()));
