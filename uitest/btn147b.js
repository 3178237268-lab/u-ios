const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport:{width:1280,height:950} });
  await p.goto('http://127.0.0.1:8787/admin.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(500); await p.fill('#lgUser','admin123'); await p.fill('#lgPass','admin123');
  await p.click('.login-card .btn, .login-card button'); await p.waitForTimeout(1800);
  const r = await p.evaluate(()=>{
    const kv = document.querySelector('#serverKv');
    const rows = [...kv.querySelectorAll('.row')];
    const probe = document.createElement('div');
    probe.className = 'row';
    probe.innerHTML = '<span>X</span><span>Y</span>';
    kv.appendChild(probe);
    const pr = probe.getBoundingClientRect();
    const info = {
      probeRow: {w: Math.round(pr.width), h: Math.round(pr.height)},
      parentDisplay: getComputedStyle(probe).display,
      // 关键：看看 flex item 的宽度是否被 flex-shrink 归零
      spans: [...probe.children].filter(c=>c.tagName==='SPAN').map(s=>({txt:s.textContent, w:Math.round(s.getBoundingClientRect().width), flex:getComputedStyle(s).flex, fs:getComputedStyle(s).flexShrink})),
      // 是不是有个 `span + span` 规则给撑满
      kvChildren: kv.children.length,
      cr: ['.k,.v'].map(cls=>{
        const el=document.createElement('div'); el.className='row'; el.innerHTML='<span class="k">标签</span><span class="v">值</span>';
        kv.appendChild(el); const w=el.getBoundingClientRect().width; const kw=el.querySelector('.k').getBoundingClientRect().width; el.remove(); return {w:Math.round(w), kw:Math.round(kw)};
      })
    };
    probe.remove();
    return info;
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
