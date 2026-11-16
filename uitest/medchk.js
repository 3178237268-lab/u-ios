const {chromium}=require('playwright-core');
(async()=>{
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox','--disable-gpu']});
const p=await b.newPage();
const r=await p.goto('http://127.0.0.1:8787/media/aa136cd84fd201060e211ccd');
console.log('status',r.status(),r.headers()['content-type']);
const body=await r.body().catch(()=>null);
console.log('bytes',body?body.length:-1);
await b.close();
})();