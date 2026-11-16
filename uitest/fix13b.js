const fs=require('fs');
let s=fs.readFileSync('game13.js','utf8');
s=s.replace("    await p.locator('#guestBtn').click();\n    await wait(1200);\n    await openGameViaUI(p);",
"    if (await p.locator('#guestBtn').isVisible().catch(() => false)) { await p.locator('#guestBtn').click(); }\n    await wait(1800);\n    await openGameViaUI(p);");
s=s.replace(`  await step('恢复默认位置', async () => {
    await p.evaluate(() => { const s = document.querySelector('#shOptBtn'); if (s) s.click(); });
    await wait(700);`,
`  await step('恢复默认位置', async () => {
    if (!(await p.locator('#gameSheet').evaluate(el => el.classList.contains('open')).catch(() => false))) {
      await openGameViaUI(p);
    }
    await p.locator('#shStartBtn').click().catch(() => {});
    await wait(1500);
    await p.locator('#shOptBtn').click();
    await wait(700);`);
fs.writeFileSync('game13.js',s);
console.log('ok');
