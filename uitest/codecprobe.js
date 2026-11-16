
const id = 'ac987b17257960abcf6d3331';
const url = 'http://127.0.0.1:8787/media/' + id;
(async () => {
  const head = await fetch(url, { headers: { Range: 'bytes=0-1048575' } }).then(r => r.arrayBuffer());
  const tail = await fetch(url, { headers: { Range: 'bytes=-2097152' } }).then(r => r.arrayBuffer());
  const scan = (buf, tag) => {
    const s = Buffer.from(buf).toString('latin1');
    const hits = {};
    ['ftyp','moov','mdat','avc1','hvc1','hev1','av01','vp09','mp4a','Opus','avcC','hvcC'].forEach(k => {
      const idx = s.indexOf(k);
      if (idx >= 0) hits[k] = idx;
    });
    return { tag, len: s.length, head: s.slice(0, 32).replace(/[^ -~]/g, '.'), hits };
  };
  console.log(JSON.stringify(scan(head, 'head'), null, 1));
  console.log(JSON.stringify(scan(tail, 'tail'), null, 1));
})();
