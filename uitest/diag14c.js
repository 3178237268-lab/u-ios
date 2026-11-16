const { chromium } = require('playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
const BASE='http://127.0.0.1:8787', APP='http://127.0.0.1:8765/';
(async()=>{
  const u='dg3'+Date.now().toString().slice(-6), pw='pass1234';
  const reg=await (await fetch(BASE+'/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:pw,nickname:u})})).json();
  const tok=reg.token;
  const png=Buffer.from('89504e470d0a1a0a0000000d4948445200000002000000020806000000f4784b3b0000001649444154789c636060606064606060f80f0006000101a5f8f3d20000000049454e44ae426082','hex');
  const media=await (await fetch(BASE+'/api/media',{method:'POST',headers:{'Content-Type':'image/png',Authorization:'Bearer '+tok,'X-Filename':'p.png'},body:png})).json();
  const post=await (await fetch(BASE+'/api/posts',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tok},body:JSON.stringify({text:'diag3 '+u,sensitive:true,media:[media.id]})})).json();
  const pid=post.post.id;
  const b=await chromium.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true});
  const p=await (await b.newContext({viewport:{width:430,height:900},hasTouch:true})).newPage();
  await p.goto(APP,{waitUntil:'load'}); await wait(2200);
  await p.locator('#authUser').fill(u); await p.locator('#authPass').fill(pw); await p.locator('#authSubmit').click(); await wait(2600);
  await p.evaluate(()=>{document.querySelector('#sideDrawer').classList.add('open');document.querySelector('#sideBackdrop').classList.add('open');});
  await wait(400); await p.locator('#sideAvatar').click({force:true}); await wait(1800);
  const html=await p.evaluate((id)=>{
    const art=document.querySelector('#viewProfile .post[data-id="srv_'+id+'"]');
    if(!art) return 'NO ART';
    const pm=art.querySelector('.pmedia');
    return {media: pm? pm.outerHTML.slice(0,600):'NO PMEDIA', mediaH: pm? Math.round(pm.getBoundingClientRect().height):0};
  }, pid);
  console.log(JSON.stringify(html,null,1));
  await b.close();
})();
