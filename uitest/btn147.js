const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport:{width:1280,height:950} });
  await p.goto('http://127.0.0.1:8787/admin.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(500); await p.fill('#lgUser','admin123'); await p.fill('#lgPass','admin123');
  await p.click('.login-card .btn, .login-card button'); await p.waitForTimeout(1800);
  const r = await p.evaluate(()=>{
    const rows=[...document.querySelectorAll('#serverKv .row')];
    // 测试按钮（display:inline-flex）与行（display:flex）是否同一种布局
    const test = document.createElement('div');
    test.style.cssText='display:flex;align-items:baseline;gap:10px;padding:8px 0;border:1px dashed #0f0';
    test.innerHTML = '<span style="flex:0 1 auto;white-space:nowrap;color:#888">标签</span><span style="flex:1 1 18px;min-width:8px;margin:0 10px;transform:translateY(-3px);border-bottom:1px dotted rgba(255,255,255,.3)"></span><span style="flex:1 1 auto;text-align:right;font-weight:700">值</span>';
    document.querySelector('#serverKv').appendChild(test);
    const docEl = document.createDocumentFragment();
    const doc = test.parentElement;
    const spans = test.querySelectorAll('span');
    const res = {testW: Math.round(test.getBoundingClientRect().width), spans: [...spans].map(s=>({w:Math.round(s.getBoundingClientRect().width), flex:getComputedStyle(s).flex}))};
    // 复制到与出问题的行相同的位置
    test.remove();
    return res;
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
