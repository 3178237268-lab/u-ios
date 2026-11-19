const net = require('net');
const ports = [7892, 7890, 7897, 7891, 10809, 10808, 1080, 8889, 8080];
function probe(p) {
  return new Promise(function (res) {
    const s = net.connect({ host: '127.0.0.1', port: p });
    const t = setTimeout(function () { s.destroy(); res(false); }, 700);
    s.on('connect', function () { clearTimeout(t); s.destroy(); res(true); });
    s.on('error', function () { clearTimeout(t); res(false); });
  });
}
(async function () {
  for (const p of ports) {
    if (await probe(p)) { process.stdout.write('http://127.0.0.1:' + p); return; }
  }
})();
