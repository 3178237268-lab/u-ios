/* U 一键启动：后端 API + 网页前端
   两个进程都挂在本进程下，关掉窗口 / Ctrl+C 会一起退出，
   不会再出现"窗口关了服务器还在后台跑"的情况。 */
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = __dirname;
/* 打包后的部署目录里后端就在 ROOT/src，仓库里在 ROOT/server/src；两种布局都能起 */
const SERVER_CWD = fs.existsSync(path.join(ROOT, 'server', 'src', 'server.js')) ? path.join(ROOT, 'server') : ROOT;
const kids = [];

function start(name, args, cwd, color) {
  const cp = spawn(process.execPath, args, {
    cwd: cwd,
    stdio: 'inherit',
    windowsHide: false
  });
  kids.push(cp);
  cp.on('exit', (code, signal) => {
    if (signal) console.log(`[${name}] 已结束（${signal}）`);
    else if (code) console.log(`[${name}] 退出，代码 ${code}`);
    if (name === '服务器' && code) {
      console.log('提示：8787 端口可能被占用，先双击「停止U.cmd」再启动。');
    }
  });
  return cp;
}

function bye() {
  for (const cp of kids) {
    try { cp.kill(); } catch (e) { /* 忽略 */ }
  }
  setTimeout(() => process.exit(0), 300);
}
process.on('SIGINT', bye);
process.on('SIGTERM', bye);
process.on('SIGHUP', bye);
process.on('exit', () => { for (const cp of kids) { try { cp.kill(); } catch (e) {} } });

const net = require('node:net');

function portBusy(port) {
  return new Promise((resolve) => {
    const s = net.connect({ host: '127.0.0.1', port: port });
    const done = (v) => { try { s.destroy(); } catch (e) {} resolve(v); };
    s.setTimeout(700);
    s.once('connect', () => done(true));
    s.once('timeout', () => done(false));
    s.once('error', () => done(false));
  });
}

function announce() {
  setTimeout(() => {
    console.log('');
    console.log('  网页版   http://127.0.0.1:8765/');
    console.log('  管理台   http://127.0.0.1:8787/');
    console.log('  手机同网 http://<本机IP>:8765/');
    console.log('');
    try {
      spawn('cmd', ['/c', 'start', '', 'http://127.0.0.1:8765/'], { windowsHide: true, stdio: 'ignore' });
    } catch (e) { /* 打不开浏览器就算了 */ }
  }, 2400);
}

(async () => {
  const busy = [];
  if (await portBusy(8787)) busy.push('8787（后端）');
  if (await portBusy(8765)) busy.push('8765（网页）');
  if (busy.length) {
    console.log('');
    console.log('  已经有 U 的进程在跑：' + busy.join('、'));
    console.log('  如果是残留的旧进程，先双击「停止U.cmd」再启动本文件。');
    console.log('  当前这个窗口不会启动新进程，按任意键退出。');
    await new Promise((r) => process.stdin.once('data', r));
    process.exit(0);
  }
  console.log('U 正在启动…… 关闭本窗口即停止全部服务');
  start('服务器', [path.join('src', 'server.js')], SERVER_CWD);
  setTimeout(() => {
    start('网页', ['serve-app.js', '8765'], ROOT);
  }, 900);
  announce();
})();
