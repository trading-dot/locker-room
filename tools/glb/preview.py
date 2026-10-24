import sys;sys.path.insert(0,'/home/claude/work/glb')
from glbkit import *
from PIL import Image,ImageDraw
def sheet(items,out,yaws=(0,.9,1.5708),W=300,H=440,ppm=380,cy=-.37):
    cols=len(yaws);rows=len(items);S=Image.new('RGB',(W*cols,H*rows),(238,238,238));d=ImageDraw.Draw(S)
    for r,(name,M,cy_) in enumerate(items):
        for c,y in enumerate(yaws):
            S.paste(Image.fromarray(render(M,y,W,H,cy=cy_,ppm=ppm)),(c*W,r*H))
        d.text((6,r*H+4),name,fill=(0,0,0))
    S.save(out)
