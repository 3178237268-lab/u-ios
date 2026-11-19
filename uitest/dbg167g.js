const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport:{width:1280,height:950} });
  await p.goto('http://127.0.0.1:8787/admin.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(500); await p.fill('#lgUser','admin123'); await p.fill('#lgPass','admin123');
  await p.click('.login-card .btn, .login-card button'); await p.waitForTimeout(1800);
  const r = await p.evaluate(()=>{
    const assert = (cond, msg, extra) => ({ ok: !!cond, msg, extra });
    const out = [];
    // 1) margin 是否生效
    const k = document.querySelector('#serverKv .row .k');
    const ka = getComputedStyle(k, '::after');
    out.push(assert(ka.marginLeft === '10px' && ka.marginRight === '10px', 'leader margin', ka.marginLeft + '/' + ka.marginRight));
    out.push(assert(ka.borderBottomWidth === '1px', 'leader border', ka.borderBottomWidth));
    // 2) 连线是否真的画出来：取 k 的右边缘与 v 的左边缘之间的像素
    const rw = document.querySelector('#serverKv .row');
    const kb = k.getBoundingClientRect(), vb = rw.lastElementChild.getBoundingClientRect();
    out.push(assert(vb.left - kb.right >= 18, 'key/value separation >=18px (leader visible)', Math.round(vb.left - kb.right)));
    // 3) 键值不在同一行重叠
    const overlaps = [...document.querySelectorAll('.kv .row')].filter(row => {
      const a = row.firstElementChild, c = row.lastElementChild;
      if (!a || !c || a === c) return false;
      return a.getBoundingClientRect().right > c.getBoundingClientRect().left + 1;
    }).length;
    out.push(assert(overlaps === 0, 'no key/value overlap', overlaps));
    // 4) 键永不竖排（高度 <= 单行 1.5 倍）
    const tallKeys = [...document.querySelectorAll('.kv .row .k')].filter(k => k.getBoundingClientRect().height > 26).length;
    out.push(assert(tallKeys === 0, 'no wrapped keys', tallKeys));
    // 5) 三列均分
    const cols = getComputedStyle(document.querySelector('#serverKv')).gridTemplateColumns.split(' ').map(parseFloat);
    out.push(assert(cols.length === 3 && Math.max(...cols) - Math.min(...cols) < 1, 'serverKv 3 equal columns', cols.join(',')));
    // 6) 数量
    out.push(assert(document.querySelectorAll('#serverKv .row').length === 12 && document.querySelectorAll('#serverKv .row .k').length === 12, 'serverKv 12 rows all have .k', document.querySelectorAll('#serverKv .row').length));
    return out;
  });
  console.log(JSON.stringify(r.filter(x=>!x.ok), null, 1) || '{}');
  console.log('fail count:', r.filter(x=>!x.ok).length, '/', r.length);
  await b.close();
})();
