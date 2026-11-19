const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  await page.goto('http://127.0.0.1:8787/admin.html', { waitUntil: 'domcontentloaded' });
  await page.fill('#lgUser', 'admin123');
  await page.fill('#lgPass', 'admin123');
  await page.press('#lgPass', 'Enter');
  await page.waitForTimeout(1200);
  const res = await page.evaluate(async () => {
    const bodyFont = getComputedStyle(document.body).fontFamily;
    const frames = [];
    let last = performance.now();
    let stop = false;
    const loop = () => { const t = performance.now(); frames.push(Math.round(t - last)); last = t; if (!stop) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    document.querySelector('[data-tab="versions"]').click();
    await new Promise(r => setTimeout(r, 450));
    // 连点三次按钮触发果冻回弹
    const b = document.querySelector('[data-tab="versions"]');
    b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await new Promise(r => setTimeout(r, 120));
    b.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await new Promise(r => setTimeout(r, 400));
    stop = true;
    const sorted = frames.slice(2).sort((a, b) => a - b);
    return { bodyFont, frames: sorted.length, max: sorted[sorted.length - 1], p95: sorted[Math.floor(sorted.length * 0.95)], over33: sorted.filter(x => x > 33).length };
  });
  console.log(JSON.stringify(res));
  await browser.close();
})();