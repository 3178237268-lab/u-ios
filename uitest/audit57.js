
const fs = require('fs'); const path = require('path');
const U = 'D:/deepseek/gouzuoqu/U';
function du(p) {
  let bytes = 0, files = 0;
  const stack = [p];
  while (stack.length) {
    const cur = stack.pop();
    let st; try { st = fs.lstatSync(cur); } catch (e) { continue; }
    if (st.isDirectory()) { let e2; try { e2 = fs.readdirSync(cur); } catch (e) { continue; } for (const n of e2) stack.push(path.join(cur, n)); }
    else { bytes += st.size; files++; }
  }
  return { mb: +(bytes / 1048576).toFixed(1), files };
}
const out = { top: [], backups: [], tmpTest: [], uitestData: [] };
for (const n of fs.readdirSync(U)) {
  const p = path.join(U, n);
  const st = fs.lstatSync(p);
  if (st.isDirectory()) out.top.push({ n, ...du(p) });
  else out.top.push({ n, mb: +(st.size / 1048576).toFixed(2), files: 1 });
}
out.top.sort((a, b) => b.mb - a.mb);
const B11111 = path.join(U, '11111');
out.backups = fs.readdirSync(B11111).filter(n => /^_backup-/.test(n)).map(n => ({ n, ...du(path.join(B11111, n)) }));
const TT = path.join(U, '.tmp-test');
out.tmpTest = fs.existsSync(TT) ? fs.readdirSync(TT).map(n => { const p = path.join(TT, n); const s = fs.lstatSync(p); return { n, mb: s.isDirectory() ? du(p).mb : +(s.size / 1048576).toFixed(2) }; }).sort((a,b)=>b.mb-a.mb) : [];
const UI = path.join(U, 'uitest');
out.uitestData = fs.existsSync(UI) ? fs.readdirSync(UI).filter(n => /-data$|\.png$/.test(n)).length : 0;
out.uitestCount = fs.existsSync(UI) ? fs.readdirSync(UI).length : 0;
out.uitestMb = fs.existsSync(UI) ? du(UI).mb : 0;
console.log(JSON.stringify(out, null, 1).slice(0, 4000));
