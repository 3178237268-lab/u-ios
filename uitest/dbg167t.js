const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport:{width:1280,height:950} });
  await p.goto('http://127.0.0.1:8787/admin.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(500); await p.fill('#lgUser','admin123'); await p.fill('#lgPass','admin123');
  await p.click('.login-card .btn, .login-card button'); await p.waitForTimeout(1800);
  const r = await p.evaluate(()=>{
    const rw = document.querySelector('#serverKv .row');
    const k = rw.firstElementChild, v = rw.lastElementChild;
    const read = () => ({kW:Math.round(k.getBoundingClientRect().width), kR:Math.round(k.getBoundingClientRect().right), vL:Math.round(v.getBoundingClientRect().left), afterStyle:getComputedStyle(k,'::after').borderBottomWidth});
    const out = {base: read()};
    // 行变高后是否出现
    const st = document.createElement('style'); st.id='tt';
    st.textContent = '#serverKv .row{min-height:30px!important;align-items:center!important}';
    document.head.appendChild(st); out.taller = read(); st.remove();
    // 检查 k 是否被 strut/padding 影响
    const cs=getComputedStyle(k);
    out.kBox = {padL:cs.paddingLeft, padR:cs.paddingRight, marR:cs.marginRight, gap:getComputedStyle(rw).gap};
    return out;
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
