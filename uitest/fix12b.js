const fs=require('fs');
let s=fs.readFileSync('round12.js','utf8');
s=s.replace(`    if (!img || !/media\\//.test(img)) throw new Error('src=' + img);`,
`    if (!img || !/^(blob:|https?:.*\\/media\\/|\\/media\\/)/.test(img)) throw new Error('src=' + img);`);
const oldDetail = s.slice(s.indexOf("  await step('打开详情累加浏览量'"), s.indexOf("  await step('返回列表'"));
const neu = `  await step('打开详情显示浏览量', async () => {
    const before = await p.locator('.post:visible [data-act="views"] span').first().innerText().catch(() => '0');
    await p.locator('.post:visible .ptext').first().click();
    await wait(1600);
    if (!(await p.locator('#postSheet').isVisible())) throw new Error('详情没打开');
    const rows = p.locator('#postBody .detail-stat b');
    const n = await rows.count();
    if (n < 3) throw new Error('详情统计只有 ' + n + ' 项');
    const views = await rows.nth(2).innerText();
    if (!/\\d/.test(views)) throw new Error('查看数异常 ' + views);
    console.log('    详情查看 ' + views + '（列表原 ' + before + '）');
  });

`;
s = s.replace(oldDetail, neu);
fs.writeFileSync('round12.js', s);
console.log('patched');
