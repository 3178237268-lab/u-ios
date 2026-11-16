import json, urllib.request
from PIL import Image, ImageStat
import io
ids = json.load(open(r'D:\deepseek\gouzuoqu\U\uitest\poster-ids.json', encoding='utf-8'))
out = []
for pid, post, size in ids:
    try:
        b = urllib.request.urlopen('http://127.0.0.1:8787/media/' + pid, timeout=20).read()
        im = Image.open(io.BytesIO(b)).convert('L')
        st = ImageStat.Stat(im)
        out.append((post, pid[:10], len(b), round(st.mean[0], 1), round(st.stddev[0], 1), im.size))
    except Exception as e:
        out.append((post, pid[:10], -1, str(e), 0, 0))
for r in out:
    print('post %-5s %s %6dB mean=%s std=%s %s' % r)