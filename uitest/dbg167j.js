const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport:{width:1280,height:950} });
  await p.goto('http://127.0.0.1:8787/admin.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(500); await p.fill('#lgUser','admin123'); await p.fill('#lgPass','admin123');
  await p.click('.login-card .btn, .login-card button'); await p.waitForTimeout(1800);
  const r = await p.evaluate(()=>{
    // 新建一个纯 span，手动加 ::after 内容，看 flex 是否生长
    const rw = document.querySelector('#serverKv .row');
    const clone = rw.cloneNode(true);
    clone.style.outline = '0';
    document.querySelector('#serverKv').appendChild(clone);
    const k = clone.firstElementChild;
    const ka = getComputedStyle(k, '::after');
    const childSpan = document.createElement('span');
    const info = {
      afterContent: ka.content, afterFlex: ka.flex, afterFlexGrow: ka.flexGrow, afterDisplay: ka.display, afterPos: ka.position,
      rowFlexWrap: getComputedStyle(clone).flexWrap,
      rowJustify: getComputedStyle(clone).justifyContent,
      kFlex: getComputedStyle(k).flex,
      kWidth: k.getBoundingClientRect().width,
      rowWidth: clone.getBoundingClientRect().width,
      vWidth: clone.lastElementChild.getBoundingClientRect().width,
      allSameColumn: [...document.querySelectorAll('#serverKv .row')].slice(0,3).map(x=>Math.round(x.getBoundingClientRect().width)),
      // 试着给 k 加 padding-right 看 v 是否移动
    };
    clone.remove();
    return info;
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
