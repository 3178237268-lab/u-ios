
const fs=require('fs'), vm=require('vm');
const html=fs.readFileSync('D:/deepseek/gouzuoqu/U/index.html','utf8');
const re=/<script\b([^>]*)>([\s\S]*?)<\/script>/g; let m,i=0,bad=0;
while((m=re.exec(html))){ i++; const attrs=m[1]||'', body=m[2]||'';
  if(/\bsrc=/.test(attrs) || !body.trim()) { console.log('block',i,'skip len='+body.length); continue; }
  try { new vm.Script(body); console.log('block',i,'ok len='+body.length); } catch(e){ bad++; console.log('block',i,'FAIL',e.message.slice(0,120)); }
}
console.log('blocks',i,'bad',bad);
console.log('feedList empty?', /<div id="feedList"><\/div>/.test(html), 'talkList empty?', /<div id="talkList"><\/div>/.test(html));
