// 打印一个手机能访问到的局域网 IPv4（跳过 Hyper-V / WSL / 链路本地地址）
const os = require('os');
const all = [];
for (const name in os.networkInterfaces()) {
  for (const n of os.networkInterfaces()[name] || []) {
    if (n.family === 'IPv4' && !n.internal && !/^169\.254\./.test(n.address)) all.push(n.address);
  }
}
const pick =
  all.find((a) => /^192\.168\./.test(a) && !/^192\.168\.(137|56)\./.test(a)) ||
  all.find((a) => /^(10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a)) ||
  all[0] ||
  '127.0.0.1';
console.log(pick);
