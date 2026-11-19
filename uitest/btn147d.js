const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport:{width:1280,height:950} });
  await p.goto('http://127.0.0.1:8787/admin.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(500); await p.fill('#lgUser','admin123'); await p.fill('#lgPass','admin123');
  await p.click('.login-card .btn, .login-card button'); await p.waitForTimeout(1800);
  await p.evaluate(()=>{
    const st=document.createElement('style'); st.id='r147';
    st.textContent=`
.kv .row{display:flex;align-items:baseline;gap:0;padding:8px 0;border-bottom:1px dashed rgba(255,255,255,.06)}
.kv .row .k{flex:0 0 auto;max-width:46%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dim)}
.kv .row .lead{flex:1 1 18px;min-width:8px;margin:0 10px;transform:translateY(-3px);border-bottom:1px dotted rgba(255,255,255,.22)}
.kv .row .v{flex:1 1 auto;min-width:0;text-align:right;font-weight:700;overflow-wrap:anywhere;word-break:break-word;line-height:1.45}
.kv .row .k::after{display:none!important}
#serverKv{grid-template-columns:repeat(3,minmax(0,1fr))}
@media (max-width:1000px){#serverKv{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:520px){#serverKv{grid-template-columns:1fr}}
`;
    document.head.appendChild(st);
    document.querySelectorAll('.kv .row').forEach(rw=>{
      const k=rw.querySelector('.k'), v=rw.querySelector('.v');
      if(!k||!v||rw.querySelector('.lead')) return;
      const s=document.createElement('span'); s.className='lead'; k.after(s);
    });
  });
  await p.evaluate(()=>window.scrollTo(0,0));
  const box = await p.evaluate(()=>{ const r=document.querySelector('#serverKv').getBoundingClientRect(); return {x:r.left-8,y:r.top-8,w:r.width+16,h:r.height+16}; });
  await p.screenshot({path:'D:/deepseek/gouzuoqu/U/.tmp-test/btn147d.png', clip:{x:box.x,y:box.y,width:box.w,height:box.h}});
  // 数据目录
  await p.evaluate(()=>{const e=document.querySelector('[data-tab="settings"]'); if(e)e.click();});
  await p.waitForTimeout(1200);
  await p.evaluate(()=>{
    document.querySelectorAll('.kv .row').forEach(rw=>{
      const k=rw.querySelector('.k'), v=rw.querySelector('.v');
      if(!k||!v||rw.querySelector('.lead')) return;
      const s=document.createElement('span'); s.className='lead'; k.after(s);
    });
    const st=document.createElement('style'); st.textContent=`.kv .row{display:flex;align-items:baseline;gap:0;padding:8px 0} .kv .row .k{flex:0 0 auto;max-width:46%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dim)} .kv .row .lead{flex:1 1 18px;min-width:8px;margin:0 10px;transform:translateY(-3px);border-bottom:1px dotted rgba(255,255,255,.22)} .kv .row .v{flex:1 1 auto;min-width:0;text-align:right;font-weight:700;overflow-wrap:anywhere;word-break:break-word;line-height:1.45} .kv .row .k::after{display:none!important}`; document.head.appendChild(st);
    document.querySelector('#dirKv').scrollIntoView();
  });
  await p.waitForTimeout(400);
  const box2 = await p.evaluate(()=>{ const r=document.querySelector('#dirKv').getBoundingClientRect(); return {x:r.left-8,y:r.top-8,w:r.width+16,h:r.height+16}; });
  await p.screenshot({path:'D:/deepseek/gouzuoqu/U/.tmp-test/btn147d-dir.png', clip:{x:box2.x,y:box2.y,width:box2.w,height:box2.h}});
  await b.close();
})();
