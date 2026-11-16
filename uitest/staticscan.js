
const fs=require('fs');
const html=fs.readFileSync('D:/deepseek/gouzuoqu/U/index.html','utf8');
const lines=html.split('\n');
for (const i of [1989,1990,1992,1993]) console.log(i+1, 'len=' + lines[i].length, lines[i].slice(0,80)+' ... '+lines[i].slice(-60));
console.log('total html', html.length);
const m=/<div id="feedList">[\s\S]{0,400}/.exec(html); console.log('feedList head', m&&m[0].slice(0,120));
console.log('has talkList render?', /talkList/.test(html));
for (const mm of html.matchAll(/talkList/g)) {}
console.log('talkList occurrences', (html.match(/talkList/g)||[]).length);
