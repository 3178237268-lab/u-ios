const fs = require('fs');
const p = '11111/public/admin.html';
let s = fs.readFileSync(p, 'utf8');

const start = s.indexOf('/* ===== R147');
const endAnchor = '.ud-grow .n{min-width:0}';
let a = s.indexOf('/* ===== 第147轮');
if (a < 0) a = start;
const b = s.indexOf(endAnchor);
if (a < 0 || b < 0) { console.log('ANCHOR FAIL', a, b); process.exit(1); }
console.log('replace block', a, b, JSON.stringify(s.slice(a, a + 40)));

const css = [
'/* ===== 第147轮：其他菜单也「中间分开」——所有键值行加虚线引导，服务器信息三列均分 ===== */',
'/* 为什么不用 .k::after 撑开：.k 是 flex item，它的 auto 宽度会被伪元素撑满，标签和值就贴到一起。',
'   改成在 .k 后面插一个独立的 <span class="lead"> 弹性占位，.v 保持 flex:1 1 auto 贴右。 */',
'#serverKv{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 26px}',
'.kv .row .k{flex:0 0 auto;max-width:46%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dim)}',
'.kv .row .k::after{display:none!important}',
'.kv .row .lead{flex:1 1 18px;min-width:8px;margin:0 10px;transform:translateY(-3px);border-bottom:1px dotted rgba(255,255,255,.22)}',
'.kv .row .v{flex:1 1 auto;min-width:0;text-align:right;font-weight:700;overflow-wrap:anywhere;word-break:break-word;line-height:1.45}',
'/* 没有 .lead 的行（历史遗留下的 .k 后直接接 .v）：用 gap 兜底，至少不贴在一起 */',
'.kv .row:has(.k):not(:has(.lead)){gap:18px}',
'@media (max-width:1000px){#serverKv{grid-template-columns:repeat(2,minmax(0,1fr))}}',
'@media (max-width:520px){#serverKv{grid-template-columns:1fr}}',
'',
].join('\n');

s = s.slice(0, a) + css + s.slice(b);

// 运行时补 .lead：所有 .kv .row 里 .k 后面没有 .lead 的插一个
const injectAnchor = "  function $on(";
if (s.indexOf(injectAnchor) < 0) { console.log('inject anchor missing, searching alternatives'); }
const helper = [
"(function () {",
"  // 第147轮：键值行中间加虚线引导（.k 后插 .lead，不放进 .k 的伪元素里，免得撑满标签宽度）",
"  function fillLeads(root) {",
"    var rows = (root || document).querySelectorAll('.kv .row, .endpoint');",
"    for (var i = 0; i < rows.length; i++) {",
"      var row = rows[i];",
"      var k = row.querySelector('.k') || row.firstElementChild;",
"      var v = row.querySelector('.v') || row.lastElementChild;",
"      if (!k || !v || k === v || row.querySelector('.lead')) continue;",
"      var lead = document.createElement('span');",
"      lead.className = 'lead';",
"      if (k.nextSibling) row.insertBefore(lead, k.nextSibling); else row.appendChild(lead);",
"    }",
"  }",
"  window.__uFillLeads = fillLeads;",
"  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { fillLeads(); }); else fillLeads();",
"  // 面板数据是异步渲染的，观察 .kv 容器变化补一次",
"  try {",
"    var mo = new MutationObserver(function (muts) {",
"      for (var i = 0; i < muts.length; i++) {",
"        var t = muts[i].target;",
"        if (t && t.classList && t.classList.contains('kv')) { fillLeads(t); }",
"      }",
"    });",
"    document.querySelectorAll('.kv').forEach(function (kv) { mo.observe(kv, { childList: true }); });",
"  } catch (e) {}",
"})();",
"",
].join('\n');

const bodyEnd = s.lastIndexOf('</body>');
if (bodyEnd > 0) {
  const scriptOpen = s.lastIndexOf('<script', bodyEnd);
  s = s.slice(0, scriptOpen) + '<script>\n' + helper + '</script>\n' + s.slice(scriptOpen);
} else {
  s += '\n<script>\n' + helper + '</script>\n';
}

fs.writeFileSync(p, s);
console.log('written', s.length);
