const fs = require('fs');
const p = '11111/public/admin.html';
let s = fs.readFileSync(p, 'utf8');
const before = s.length;

// addr-k 的 ::after 会把自身撑满（和 .k 同一个坑）：改成 .lead 兄弟节点
s = s.replace(".addr-item{gap:0;align-items:baseline}\n.addr-k{display:flex;align-items:baseline;flex:0 1 auto;min-width:0;white-space:nowrap}\n.addr-k::after{content:'';flex:1 1 16px;min-width:8px;margin:0 10px;transform:translateY(-3px);border-bottom:1px dotted rgba(255,255,255,.17)}\n.addr-v{flex:1 1 auto;min-width:0;overflow-wrap:anywhere;word-break:break-word}",
".addr-item{gap:0;align-items:baseline}\n.addr-k{flex:0 0 auto;max-width:48%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.addr-k::after{display:none!important}\n.addr-item .lead{flex:1 1 18px;min-width:8px;margin:0 10px;transform:translateY(-3px);border-bottom:1px dotted rgba(255,255,255,.22)}\n.addr-v{flex:1 1 auto;min-width:0;overflow-wrap:anywhere;word-break:break-word}");

// 行模板里插入 lead
s = s.replace(`return '<div class="addr-item"><span class="addr-k">' + esc(it[0]) + '</span>' + val + '</div>';`,
`return '<div class="addr-item"><span class="addr-k">' + esc(it[0]) + '</span><span class="lead"></span>' + val + '</div>';`);

// 补 lead 的函数也覆盖 .addr-item / .aiu-item / .endpoint
s = s.replace("var rows = (root || document).querySelectorAll('.kv .row, .endpoint');",
"var rows = (root || document).querySelectorAll('.kv .row, .addr-item, .aiu-item, .endpoint');");
s = s.replace("var k = row.querySelector('.k') || row.firstElementChild;",
"var k = row.querySelector('.k, .addr-k') || row.firstElementChild;");
s = s.replace("var v = row.querySelector('.v') || row.lastElementChild;",
"var v = row.querySelector('.v, .addr-v') || row.lastElementChild;");

fs.writeFileSync(p, s);
console.log(before, '->', s.length);
