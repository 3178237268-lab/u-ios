const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport:{width:1280,height:950} });
  await p.goto('http://127.0.0.1:8787/admin.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(500); await p.fill('#lgUser','admin123'); await p.fill('#lgPass','admin123');
  await p.click('.login-card .btn, .login-card button'); await p.waitForTimeout(1800);
  const r = await p.evaluate(()=>{
    const kv=document.querySelector('#serverKv');
    const rows=[...kv.querySelectorAll('.row')];
    return rows.slice(0,6).map(rw=>{
      const k=rw.firstElementChild, v=rw.lastElementChild;
      const kb=k.getBoundingClientRect(), vb=v.getBoundingClientRect();
      const ka=getComputedStyle(k,'::after');
      return {t:k.textContent.slice(0,8), kL:Math.round(kb.left), kR:Math.round(kb.right), kH:Math.round(kb.height),
        vL:Math.round(vb.left), vR:Math.round(vb.right), gap:Math.round(vb.left-kb.right),
        ka:{content:ka.content, w:ka.width, border:ka.borderBottomWidth+' '+ka.borderBottomStyle, flex:ka.flex},
        rowW:Math.round(rw.getBoundingClientRect().width), kvW:Math.round(kv.getBoundingClientRect().width)};
    });
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
