const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const p = await (await b.newContext()).newPage();
  const reqs = [];
  p.on('request', r => reqs.push(['REQ', r.url().slice(0, 110), r.resourceType()]));
  p.on('requestfailed', r => reqs.push(['FAIL', r.url().slice(0, 110), (r.failure()||{}).errorText]));
  p.on('response', r => { if (r.status() >= 400) reqs.push(['HTTP' + r.status(), r.url().slice(0, 110), r.request().resourceType()]); });
  await p.goto('http://127.0.0.1:8765/.tmp-test/preview-sandbox.html', { waitUntil: 'load' });
  await p.waitForTimeout(4000);
  const srv = reqs.filter(r => r[0] !== 'REQ');
  console.log('non-200 events:'); srv.forEach(r => console.log(' ', r.join(' | ')));
  console.log('total requests', reqs.length);
  console.log('sample urls:'); reqs.slice(0, 8).forEach(r => console.log(' ', r[1], r[2]));
  await b.close();
})();
