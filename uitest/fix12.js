const fs=require('fs');
let s=fs.readFileSync('round12.js','utf8');
s=s.replace(`await p.locator('#authUser, #loginUser, input[placeholder="账号"]').first().fill(u);`,"await p.locator('#authUser').fill(u);");
s=s.replace(`await p.locator('#authPass, #loginPass, input[placeholder="密码"]').first().fill(pass);`,"await p.locator('#authPass').fill(pass);");
s=s.replace(`await p.locator('#loginBtn, button:has-text("登录")').first().click();`,"await p.locator('#authSubmit').click();");
s=s.replace(`await p.locator('#feedTabTalk, .feed-tab[data-channel="talk"], button:has-text("说说")').first().click();`,"await p.locator('.feedtab[data-home=\"talk\"]').click();");
fs.writeFileSync('round12.js',s);
console.log('ok');
