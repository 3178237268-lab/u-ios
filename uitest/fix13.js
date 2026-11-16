const fs=require('fs');
let s=fs.readFileSync('game13.js','utf8');
s=s.split("await p.evaluate(() => { if (window.openGame) window.openGame(); });").join("await openGameViaUI(p);");
s=s.replace("(async () => {", "async function openGameViaUI(p) {\n  await p.locator('#sideTab, .side-trigger, #menuBtn').first().click({ timeout: 5000 }).catch(() => {});\n  await new Promise(r => setTimeout(r, 600));\n  const it = p.locator('[data-side=\"game\"]');\n  if (!(await it.isVisible().catch(() => false))) {\n    await p.evaluate(() => { const d = document.querySelector('#sideDrawer'); if (d) d.classList.add('open'); const b = document.querySelector('#sideBackdrop'); if (b) b.classList.add('open'); });\n    await new Promise(r => setTimeout(r, 500));\n  }\n  await it.click({ force: true });\n  await new Promise(r => setTimeout(r, 1400));\n}\n\n(async () => {");
fs.writeFileSync('game13.js',s);
console.log('ok');
