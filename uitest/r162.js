const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8787/admin.html', { waitUntil: 'domcontentloaded' });
  await page.fill('#lgUser', 'admin123');
  await page.fill('#lgPass', 'admin123');
  await page.press('#lgPass', 'Enter');
  await page.waitForTimeout(1200);

  const style = await page.evaluate(() => {
    const g = (sel, props) => { const el = document.querySelector(sel); if (!el) return null;
      const cs = getComputedStyle(el); const o = {}; props.forEach(p => o[p] = cs[p]); return o; };
    return {
      body: g('body', ['fontFamily', 'letterSpacing', 'lineHeight', 'fontFeatureSettings']),
      btn: g('.btn', ['borderRadius', 'fontWeight', 'transition']),
      tabs: g('.tabs', ['borderRadius']),
      tab: g('.tab', ['borderRadius', 'fontWeight', 'animationName']),
      panel: g('.panel', ['borderRadius']),
      stat: g('.stat', ['borderRadius', 'transition']),
      sw: g('.switch-row input', ['transition']),
      search: g('.search', ['borderRadius'])
    };
  });

  // 换页果冻：点「历史版本」看进场动画
  await page.click('[data-tab="versions"]');
  await page.waitForTimeout(120);
  const viewAnim = await page.evaluate(() => {
    const v = document.querySelector('#view-versions');
    const cs = getComputedStyle(v);
    return { cls: v.className, anim: cs.animationName, dur: cs.animationDuration, display: cs.display };
  });
  await page.waitForTimeout(900);

  // 图标：上下移动按钮
  const icons = await page.evaluate(() => {
    const b = [...document.querySelectorAll('[data-vermove]')].slice(0, 2);
    return b.map(x => { const s = x.querySelector('svg'); const rb = x.getBoundingClientRect();
      const sb = s && s.getBoundingClientRect();
      return { text: x.textContent.trim().slice(0, 4), hasSvg: !!s,
        btn: rb.width + 'x' + rb.height, svg: sb ? Math.round(sb.width) + 'x' + Math.round(sb.height) : null,
        radius: getComputedStyle(x).borderRadius }; });
  });

  // 性能：连续切页 8 次，记录每次点击到下一帧的耗时
  const perf = await page.evaluate(async () => {
    const tabs = ['overview', 'users', 'posts', 'settings', 'versions', 'logs', 'net', 'api'];
    const out = [];
    for (const t of tabs) {
      const el = document.querySelector('[data-tab="' + t + '"]');
      const t0 = performance.now();
      el.click();
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      out.push(Math.round(performance.now() - t0));
    }
    return out;
  });

  await page.click('[data-tab="overview"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/r162-admin.png' });
  await page.click('[data-tab="versions"]');
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'D:/deepseek/gouzuoqu/U/.tmp-test/r162-versions.png' });
  console.log(JSON.stringify({ style, viewAnim, icons, perf, errs }, null, 1));
  await browser.close();
})();