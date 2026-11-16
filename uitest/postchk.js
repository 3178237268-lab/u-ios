
const ids = ['196b69d6a97b4fcc8e22ca43','9f33701f47b1412dafe2f59d','2f784afa09ac1cd85ff44706','4260c21df103f8c228611c17'];
(async () => {
  const { DatabaseSync } = require('node:sqlite');
  for (const id of ids) {
    const r = await fetch('http://127.0.0.1:8787/media/' + id);
    const buf = Buffer.from(await r.arrayBuffer());
    console.log(id, r.status, r.headers.get('content-type'), buf.length);
  }
})();
