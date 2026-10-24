"""Generator model .glb untuk showroom. Jalankan:  python3 tools/glb/make_all.py [--preview]
Butuh: python3, numpy, scipy, pillow.  Hasil: assets/models/<modelKey>.glb (+ preview.png bila --preview)."""
import os,sys
HERE=os.path.dirname(os.path.abspath(__file__));sys.path.insert(0,HERE)
from tops import *;from accs import *
OUT=os.path.abspath(os.path.join(HERE,'..','..','assets','models'));os.makedirs(OUT,exist_ok=True)
MODELS={k:(lambda k=k:make_top(k)) for k in KIND}
MODELS.update({'aksesoris_topi':make_cap,'aksesoris_syal':make_scarf,'aksesoris_tas':make_tote,'aksesoris_lainnya':make_pouch})
VIEW={'aksesoris_topi':(900,-.1),'aksesoris_syal':(250,-.46),'aksesoris_tas':(560,-.2),'aksesoris_lainnya':(700,-.13)}  # (piksel per meter, pusat y) khusus pratinjau
if __name__=='__main__':
    meshes={}
    for k,fn in MODELS.items():
        M,ex=fn();sz,nv,nt=write_glb(os.path.join(OUT,k+'.glb'),M,ex);meshes[k]=M;print(f'{k:22s} {sz/1024:5.0f} KB  {nv} verts  {nt} tris')
    if '--preview' in sys.argv:
        from PIL import Image,ImageDraw;from preview import render
        W,H=260,340;S=Image.new('RGB',(W*5,H*2),(238,238,238));d=ImageDraw.Draw(S)
        for i,(k,M) in enumerate(meshes.items()):
            ppm,cy=VIEW.get(k,(205,-.36));x,y=(i%5)*W,(i//5)*H;S.paste(Image.fromarray(render(M,.7,W,H,cy=cy,ppm=ppm)),(x,y));d.text((x+8,y+6),k,fill=(40,40,40))
        S.save(os.path.join(OUT,'preview.png'));print('preview.png dibuat')
