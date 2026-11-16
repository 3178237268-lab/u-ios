const urls=[
'https://api.codetabs.com/v1/proxy?quest=https://fabric-tear.vercel.app/',
'https://corsproxy.io/?https://fabric-tear.vercel.app/',
'https://api.allorigins.win/raw?url=https://fabric-tear.vercel.app/',
'https://thingproxy.freeboard.io/fetch/https://fabric-tear.vercel.app/',
'https://api.cors.lol/?url=https://fabric-tear.vercel.app/'
];
(async()=>{for(const u of urls){ const k=u.split('/')[2]; try{ const r=await fetch(u,{signal:AbortSignal.timeout(12000)}); const txt=await r.text(); console.log(k, r.status, txt.length, JSON.stringify(txt.slice(0,160))); }catch(e){ console.log(k,'ERR',String(e.message).slice(0,50)); } }})();