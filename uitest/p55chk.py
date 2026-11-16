import os,glob
from PIL import Image
for f in sorted(glob.glob('D:/deepseek/gouzuoqu/U/uitest/p55/*.jpg')):
    b=open(f,'rb').read()
    head=b[:8]
    try:
        im=Image.open(f); im.load(); print(os.path.basename(f), len(b), head[:4], im.size, im.mode)
    except Exception as e:
        print(os.path.basename(f), len(b), head[:4], 'DECODE-FAIL', repr(e)[:80])
