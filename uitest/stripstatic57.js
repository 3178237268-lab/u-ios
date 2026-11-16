
const fs=require('fs');
const P='D:/deepseek/gouzuoqu/U/index.html';
const src=fs.readFileSync(P,'utf8');
const lines=src.split('\n');
const iFeed=1990-1, iTalk=1994-1;
const feed=lines[iFeed], talk=lines[iTalk];
if(!/^\s*<div id="feedList">/.test(feed)) throw new Error('feed anchor mismatch: '+feed.slice(0,60));
if(!/^\s*<div id="talkList">/.test(talk)) throw new Error('talk anchor mismatch: '+talk.slice(0,60));
const feedLen=feed.length, talkLen=talk.length;
lines[iFeed]='      <div id="feedList"></div>';
lines[iTalk]='      <div id="talkList"></div>';
const out=lines.join('\n');
fs.writeFileSync(P, out, 'utf8');
console.log(JSON.stringify({before: src.length, after: out.length, saved: src.length-out.length, feedLen, talkLen, leftStaticPosts: (out.match(/<div id="talkList">[\s\S]{0,40}/)||[''])[0].slice(0,60)}));
