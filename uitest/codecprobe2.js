
const id = 'ac987b17257960abcf6d3331';
const size = 331336297;
const url = 'http://127.0.0.1:8787/media/' + id;
(async () => {
  const r = await fetch(url, { headers: { Range: 'bytes=' + (size - 600000) + '-' + (size - 1) } });
  console.log('status', r.status, 'len', (await r.clone().arrayBuffer()).byteLength);
  const buf = Buffer.from(await r.arrayBuffer());
  const s = buf.toString('latin1');
  const tags = ['moov','trak','avc1','hvc1','hev1','av01','vp09','mp4a','avcC','hvcC','av1C','stsd'];
  const found = {};
  tags.forEach(t => { const i = s.indexOf(t); if (i >= 0) found[t] = i; });
  console.log(JSON.stringify(found));
  const i = s.indexOf('stsd');
  if (i >= 0) console.log('stsd region:', s.slice(i, i + 160).replace(/[^ -~]/g, '.'));
})();
