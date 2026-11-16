
const { chromium } = require('playwright-core');
const fs = require('node:fs'); const path = require('node:path');
const SRC = 'C:\\Users\\YeKi8\\.dsh\\attachments\\v1\\objects\\88\\889a58285dabdae0c0e7b3d8434d54fa07b7610cbeb7e263925854af79950f04';
(async () => {
  const b64 = fs.readFileSync(SRC).toString('base64');
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await browser.newPage();
  await page.setContent('<body style="margin:0;background:#000"><img id="i"></body>');
  const r = await page.evaluate(async (b64) => {
    const img = document.getElementById('i');
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const reds = [];
    let maxD = 0, maxPix = null;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4, R = d[i], G = d[i + 1], B = d[i + 2];
      const dm = R - Math.max(G, B);
      if (dm > maxD) { maxD = dm; maxPix = { x, y, r: R, g: G, b: B }; }
      if (dm >= 4) reds.push({ x, y, r: R, g: G, b: B, dm });
    }
    return { w: c.width, h: c.height, count: reds.length, maxD, maxPix, sample: reds.slice(0, 12) };
  }, b64);
  console.log(JSON.stringify(r));
  await browser.close();
})().catch((e) => console.log(JSON.stringify({ fatal: String(e).slice(0, 200) })));
