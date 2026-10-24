import json,struct,glob,io,sys,numpy as np
from PIL import Image
D=sys.argv[1];sz={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4};tot=0;bad=0
for f in sorted(glob.glob(D+'/*.glb')):
    b=open(f,'rb').read();mg,ver,ln=struct.unpack('<4sII',b[:12]);assert mg==b'glTF' and ver==2 and ln==len(b),'header'
    jl,jt=struct.unpack('<I4s',b[12:20]);js=json.loads(b[20:20+jl]);o=20+jl;bl,bt=struct.unpack('<I4s',b[o:o+8]);BIN=b[o+8:o+8+bl]
    assert jt==b'JSON' and bt==b'BIN\0' and o+8+bl==len(b);errs=[];A=js['accessors'];BV=js['bufferViews'];allv=[];info=[]
    for i,v in enumerate(BV):
        if v['byteOffset']%4 or v['byteOffset']+v['byteLength']>len(BIN): errs.append(f'bufferView {i} salah')
    for p in js['meshes'][0]['primitives']:
        def get(ai,dt):
            a=A[ai];v=BV[a['bufferView']];return np.frombuffer(BIN,dt,a['count']*sz[a['type']],v['byteOffset']).reshape(a['count'],-1)
        pa=A[p['attributes']['POSITION']];n=pa['count'];P=get(p['attributes']['POSITION'],'<f4');N=get(p['attributes']['NORMAL'],'<f4');UV=get(p['attributes']['TEXCOORD_0'],'<f4')
        ia=A[p['indices']];I=get(p['indices'],'<u2' if ia['componentType']==5123 else '<u4').ravel();allv.append(P)
        if not(np.allclose(P.min(0),pa['min'],atol=1e-5) and np.allclose(P.max(0),pa['max'],atol=1e-5)): errs.append('min/max POSITION tidak cocok')
        if I.max()>=n or len(I)%3: errs.append('indeks di luar batas')
        if not(np.isfinite(P).all() and np.isfinite(N).all() and np.isfinite(UV).all()): errs.append('NaN/Inf')
        if abs(np.linalg.norm(N,axis=1).mean()-1)>.01: errs.append('normal tidak unit')
        T=P[I.reshape(-1,3)];deg=int((np.linalg.norm(np.cross(T[:,1]-T[:,0],T[:,2]-T[:,0]),axis=1)<1e-12).sum());info.append(f'mat{p["material"]}:{n}v/{len(I)//3}t/deg{deg}')
    for im in js['images']:
        v=BV[im['bufferView']];Image.open(io.BytesIO(BIN[v['byteOffset']:v['byteOffset']+v['byteLength']])).verify()
    a=np.vstack(allv);mn,mx=a.min(0),a.max(0);bad+=len(errs);tot+=1
    print(f"{f.split('/')[-1]:24s} {len(b)/1024:4.0f}KB y[{mn[1]:+.2f},{mx[1]:+.2f}] x[{mn[0]:+.2f},{mx[0]:+.2f}] z[{mn[2]:+.3f},{mx[2]:+.3f}] {' '.join(info)} extras={js['scenes'][0]['extras']['zf']}{' ERR:'+';'.join(errs) if errs else ' OK'}")
print(f'{tot} file diperiksa, {bad} masalah')
