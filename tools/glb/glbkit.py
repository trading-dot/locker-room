import numpy as np, json, struct, io
from scipy.spatial import Delaunay
from PIL import Image
PI=np.pi
def smooth(x): x=np.clip(x,0,1); return x*x*(3-2*x)
def prof(x): x=np.clip(x,0,1); return np.sqrt(1-(1-x)**2)
def area(P): x,y=P[:,0],P[:,1]; return .5*np.sum(x*np.roll(y,-1)-np.roll(x,-1)*y)
def ccw(P,R=None):
    P=np.asarray(P,float)
    if area(P)<0:
        P=P[::-1]; R=None if R is None else np.asarray(R)[::-1]
    return (P,R) if R is not None else P
def round_poly(P,R):
    P=np.asarray(P,float); n=len(P); R=np.broadcast_to(np.asarray(R,float),(n,)); out=[]
    for i in range(n):
        p=P[i];a=P[i-1];b=P[(i+1)%n];va=a-p;vb=b-p;la=np.linalg.norm(va);lb=np.linalg.norm(vb)
        d=min(R[i],.45*la,.45*lb)
        if d<1e-6: out.append(p);continue
        p1=p+va/la*d;p2=p+vb/lb*d
        for t in np.linspace(0,1,7): out.append((1-t)**2*p1+2*(1-t)*t*p+t*t*p2)
    O=np.array(out);keep=np.r_[True,np.linalg.norm(np.diff(O,axis=0),axis=1)>1e-6]
    return O[keep]
def resample(P,h):
    Q=np.vstack([P,P[:1]]);L=np.r_[0,np.cumsum(np.linalg.norm(np.diff(Q,axis=0),axis=1))]
    n=max(8,int(round(L[-1]/h)));s=np.linspace(0,L[-1],n,endpoint=False)
    return np.stack([np.interp(s,L,Q[:,0]),np.interp(s,L,Q[:,1])],1)
def seg_dist(pts,poly):
    A=poly;B=np.roll(poly,-1,0);AB=B-A;L2=(AB**2).sum(1)+1e-12;out=np.empty(len(pts))
    for i in range(0,len(pts),1500):
        p=pts[i:i+1500][:,None,:];t=np.clip(((p-A)*AB).sum(2)/L2,0,1)
        out[i:i+1500]=np.linalg.norm(p-(A+t[...,None]*AB),axis=2).min(1)
    return out
def inside(pts,poly):
    res=np.empty(len(pts),bool);A=poly;B=np.roll(poly,-1,0)
    for i in range(0,len(pts),1500):
        x=pts[i:i+1500,0][:,None];y=pts[i:i+1500,1][:,None]
        c=((A[:,1]>y)!=(B[:,1]>y))&(x<(B[:,0]-A[:,0])*(y-A[:,1])/(B[:,1]-A[:,1]+1e-18)+A[:,0])
        res[i:i+1500]=(c.sum(1)%2)==1
    return res
class Mesh:
    def __init__(s,V,UV,C,F,mat=0): s.V=np.asarray(V,float);s.UV=np.asarray(UV,float);s.C=np.asarray(C,float);s.F=np.asarray(F,int);s.mat=mat
def pillow(poly,h=.014,tmax=.036,e=.03,zoff=0.,front_only=False,fold=(None,None),cut=None,uvs=.05,uvrot=0.,col=None,mat=0,tmax_back=None,tscale=None):
    poly=np.asarray(poly,float);B=resample(poly,h*.95);nb=len(B)
    T=np.roll(B,-1,0)-np.roll(B,1,0);T/=np.linalg.norm(T,axis=1,keepdims=True)+1e-12;N=np.stack([-T[:,1],T[:,0]],1)
    pl=[B]
    for d in (.3*e,.7*e):
        R=B+N*d;R=R[inside(R,poly)];R=R[seg_dist(R,poly)>.8*d];pl.append(R)
    x0,y0=poly.min(0);x1,y1=poly.max(0);xs=np.arange(x0,x1+h,h);ys=np.arange(y0,y1+h,h*.866)
    G=np.array([(x+(h*.5 if j%2 else 0),y) for j,y in enumerate(ys) for x in xs]);G=G[inside(G,poly)];G=G[seg_dist(G,poly)>.7*e+.5*h]
    pts=np.vstack(pl+[G]);nv=len(pts)
    tri=Delaunay(pts).simplices;c=pts[tri].mean(1);ok=inside(c,poly)
    el=np.maximum.reduce([np.linalg.norm(pts[tri[:,i]]-pts[tri[:,(i+1)%3]],axis=1) for i in range(3)]);ok&=el<3.4*h;tri=tri[ok]
    a=pts[tri[:,0]];b=pts[tri[:,1]];cc=pts[tri[:,2]];cr=(b[:,0]-a[:,0])*(cc[:,1]-a[:,1])-(b[:,1]-a[:,1])*(cc[:,0]-a[:,0])
    tri=np.where((cr<0)[:,None],tri[:,[0,2,1]],tri)
    s=seg_dist(pts,poly);s[:nb]=0;fx,fy=pts[:,0],pts[:,1];w=smooth(s/(1.3*e));tm=tmax if tmax_back is None else tmax_back
    ffn,fbn=fold;ff=ffn(fx,fy)*w if ffn else 0;fb=fbn(fx,fy)*w if fbn else 0
    ts=tscale(fx,fy) if tscale else 1;zf=zoff+tmax*ts*prof(s/e)+ff;zb=zoff-(tm*ts*prof(s/e)+fb)
    Vf=np.column_stack([fx,fy,zf]);front=tri if cut is None else tri[~cut(pts[tri].mean(1))]
    if front_only: V=Vf;F=front;side=np.ones(nv);S=s
    else:
        bidx=np.arange(nv);bidx[nb:]=nv+np.arange(nv-nb)
        V=np.vstack([Vf,np.column_stack([fx[nb:],fy[nb:],zb[nb:]])]);F=np.vstack([front,bidx[tri][:,[0,2,1]]])
        side=np.r_[np.ones(nv),-np.ones(nv-nb)];S=np.r_[s,s[nb:]]
    cr_,sr_=np.cos(uvrot),np.sin(uvrot);UV=np.stack([(V[:,0]*cr_+V[:,1]*sr_)/uvs,(-V[:,0]*sr_+V[:,1]*cr_)/uvs],1)
    C=np.ones(len(V)) if col is None else col(V,S,side)
    m=Mesh(V,UV,C,F,mat)
    def surf(P,front=True):
        P=np.asarray(P,float);ss=seg_dist(P,poly);ww=smooth(ss/(1.3*e))
        tt=tscale(P[:,0],P[:,1]) if tscale else 1
        if front: return zoff+tmax*tt*prof(ss/e)+(ffn(P[:,0],P[:,1])*ww if ffn else 0)
        return zoff-(tm*tt*prof(ss/e)+(fbn(P[:,0],P[:,1])*ww if fbn else 0))
    m.surf=surf;return m
def tube(path,rx,rz,n=10,closed=False,ref=None,col=1.0,mat=0,uvs=.05,caps=True):
    P=np.asarray(path,float);m=len(P);rx=np.broadcast_to(np.asarray(rx,float),(m,));rz=np.broadcast_to(np.asarray(rz,float),(m,))
    Tg=(np.roll(P,-1,0)-np.roll(P,1,0))/2 if closed else np.gradient(P,axis=0)
    Tg=Tg/(np.linalg.norm(Tg,axis=1,keepdims=True)+1e-12)
    R=np.tile([0,0,1.],(m,1)) if ref is None else np.asarray(ref,float)*np.ones((m,3))
    v=R-(R*Tg).sum(1,keepdims=True)*Tg;v/=np.linalg.norm(v,axis=1,keepdims=True)+1e-12;u=np.cross(Tg,v)
    a=np.linspace(0,2*PI,n,endpoint=False)
    ring=u[:,None,:]*(rx[:,None,None]*np.cos(a)[None,:,None])+v[:,None,:]*(rz[:,None,None]*np.sin(a)[None,:,None])
    V=(P[:,None,:]+ring).reshape(-1,3);rows=m if closed else m-1
    i=np.arange(rows)[:,None];j=np.arange(n)[None,:];i2=(i+1)%m
    a_=i*n+j;b_=i*n+(j+1)%n;c_=i2*n+(j+1)%n;d_=i2*n+j
    F=np.concatenate([np.stack([a_,b_,c_],-1).reshape(-1,3),np.stack([a_,c_,d_],-1).reshape(-1,3)])
    arc=np.r_[0,np.cumsum(np.linalg.norm(np.diff(P,axis=0),axis=1))]/uvs
    UV=np.stack([np.repeat(arc,n),np.tile(a/(2*PI)*2,m)],1)
    if caps and not closed:
        for k,(r0,flip) in enumerate(((0,True),(m-1,False))):
            ci=len(V);V=np.vstack([V,P[r0]]);UV=np.vstack([UV,[arc[r0],0]])
            f=np.stack([np.full(n,ci),r0*n+np.arange(n),r0*n+(np.arange(n)+1)%n],1)
            F=np.vstack([F,f[:,[0,2,1]] if flip else f])
    return Mesh(V,UV,np.full(len(V),col) if np.ndim(col)==0 else col,F)
def grid_surface(X,Y,Z,wrap=True,col=1.0,mat=0,uvs=.05):
    nu,nv=X.shape;V=np.stack([X,Y,Z],-1).reshape(-1,3);i=np.arange(nu-1)[:,None];j=np.arange(nv)[None,:]
    j2=(j+1)%nv if wrap else np.minimum(j+1,nv-1);a=i*nv+j;b=i*nv+j2;c=(i+1)*nv+j2;d=(i+1)*nv+j
    F=np.concatenate([np.stack([a,b,c],-1).reshape(-1,3),np.stack([a,c,d],-1).reshape(-1,3)])
    UV=np.stack([V[:,0]/uvs,V[:,1]/uvs],1);return Mesh(V,UV,np.full(len(V),col) if np.ndim(col)==0 else col,F,mat)
def vnormals(V,F):
    n=np.zeros_like(V);fn=np.cross(V[F[:,1]]-V[F[:,0]],V[F[:,2]]-V[F[:,0]])
    for k in range(3): np.add.at(n,F[:,k],fn)
    return n/(np.linalg.norm(n,axis=1,keepdims=True)+1e-12)
# ---------- peta normal kain (tileable) ----------
def _normal_png(hmap,k):
    dx=(np.roll(hmap,-1,1)-np.roll(hmap,1,1))*k;dy=(np.roll(hmap,-1,0)-np.roll(hmap,1,0))*k
    n=np.stack([-dx,dy,np.ones_like(dx)],-1);n/=np.linalg.norm(n,axis=-1,keepdims=True)
    img=Image.fromarray(((n*.5+.5)*255).astype(np.uint8));b=io.BytesIO();img.save(b,'PNG',optimize=True);return b.getvalue()
def weave_png(S=128,th=16):
    p=S//th;u,v=np.meshgrid(np.arange(S),np.arange(S));cu=np.cos((u%p)/p*PI-PI/2);cv=np.cos((v%p)/p*PI-PI/2)
    top=(((u//p)+(v//p))%4)<2;h=np.where(top,cu**.7*.6+.4,cv**.7*.6+.4)
    h+=.1*np.random.default_rng(3).standard_normal((S,S));return _normal_png(h,3.2)
def rib_png(S=128,rb=12):
    u,v=np.meshgrid(np.arange(S),np.arange(S));h=.5+.5*np.cos(u/S*rb*2*PI)+.08*np.cos(v/S*PI*24)
    return _normal_png(h,2.2)
# ---------- GLB ----------
def write_glb(path,meshes,extras,tex_scale=(.8,1.0)):
    bin_=bytearray();bvs=[];acs=[]
    def bv(data,target=None):
        bin_.extend(b'\0'*((-len(bin_))%4));off=len(bin_);bin_.extend(data)
        d={"buffer":0,"byteOffset":off,"byteLength":len(data)}
        if target:d["target"]=target
        bvs.append(d);return len(bvs)-1
    def ac(b,ct,cnt,typ,mn=None,mx=None,norm=False):
        d={"bufferView":b,"componentType":ct,"count":cnt,"type":typ}
        if mn is not None:d["min"]=mn;d["max"]=mx
        if norm:d["normalized"]=True
        acs.append(d);return len(acs)-1
    imgs=[weave_png(),rib_png()];images=[];
    for im in imgs: images.append({"bufferView":bv(im),"mimeType":"image/png"})
    prims=[]
    for mat in sorted({m.mat for m in meshes}):
        ms=[m for m in meshes if m.mat==mat];V=[];UV=[];C=[];F=[];o=0
        for m in ms:V.append(m.V);UV.append(m.UV);C.append(m.C);F.append(m.F+o);o+=len(m.V)
        V=np.vstack(V);UV=np.vstack(UV);C=np.concatenate(C);F=np.vstack(F);N=vnormals(V,F)
        ok=(F[:,0]!=F[:,1])&(F[:,1]!=F[:,2])&(F[:,0]!=F[:,2]);F=F[ok]
        col=np.clip(np.column_stack([C,C,C,np.ones_like(C)])*255+.5,0,255).astype(np.uint8)
        idt=np.uint16 if len(V)<65535 else np.uint32
        A={"POSITION":ac(bv(V.astype('<f4').tobytes(),34962),5126,len(V),"VEC3",V.min(0).tolist(),V.max(0).tolist()),
           "NORMAL":ac(bv(N.astype('<f4').tobytes(),34962),5126,len(V),"VEC3"),
           "TEXCOORD_0":ac(bv(UV.astype('<f4').tobytes(),34962),5126,len(V),"VEC2"),
           "COLOR_0":ac(bv(col.tobytes(),34962),5121,len(V),"VEC4",norm=True)}
        ix=ac(bv(F.astype('<u2' if idt==np.uint16 else '<u4').reshape(-1).tobytes(),34963),5123 if idt==np.uint16 else 5125,F.size,"SCALAR")
        prims.append({"attributes":A,"indices":ix,"material":mat,"mode":4})
    gl={"asset":{"version":"2.0","generator":"ftr-locker-room generator"},"scene":0,"scenes":[{"nodes":[0],"extras":extras}],
        "nodes":[{"mesh":0,"name":"model","extras":extras}],"meshes":[{"primitives":prims}],
        "materials":[{"name":"kain","pbrMetallicRoughness":{"baseColorFactor":[1,1,1,1],"metallicFactor":0,"roughnessFactor":.92},"normalTexture":{"index":0,"scale":tex_scale[0]},"doubleSided":True},
                     {"name":"rib","pbrMetallicRoughness":{"baseColorFactor":[1,1,1,1],"metallicFactor":0,"roughnessFactor":.95},"normalTexture":{"index":1,"scale":tex_scale[1]},"doubleSided":True}],
        "textures":[{"source":0,"sampler":0},{"source":1,"sampler":0}],"samplers":[{"magFilter":9729,"minFilter":9987,"wrapS":10497,"wrapT":10497}],
        "images":images,"bufferViews":bvs,"accessors":acs,"buffers":[{"byteLength":len(bin_)}]}
    js=json.dumps(gl,separators=(',',':')).encode();js+=b' '*((-len(js))%4);bin_.extend(b'\0'*((-len(bin_))%4))
    out=b'glTF'+struct.pack('<II',2,12+8+len(js)+8+len(bin_))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(bin_),b'BIN\0')+bytes(bin_)
    open(path,'wb').write(out);return len(out),sum(len(m.V) for m in meshes),sum(len(m.F) for m in meshes)
# ---------- preview (rasterizer sederhana) ----------
def render(meshes,yaw,W=360,H=520,scale=None,cx=0.,cy=-.35,ppm=420):
    img=np.full((H,W,3),238,np.uint8);zb=np.full((H,W),-1e9);c,s_=np.cos(yaw),np.sin(yaw)
    L=np.array([.4,.5,.75]);L/=np.linalg.norm(L)
    for m in meshes:
        V=m.V;N=vnormals(V,m.F);X=V[:,0]*c+V[:,2]*s_;Z=-V[:,0]*s_+V[:,2]*c;Nx=N[:,0]*c+N[:,2]*s_;Nz=-N[:,0]*s_+N[:,2]*c
        sx=(X-cx)*ppm+W/2;sy=H/2-(V[:,1]-cy)*ppm;sh=np.clip(np.abs(Nx*L[0]+N[:,1]*L[1]+Nz*L[2]),0,1)*.75+.25
        sh=np.where(Nz*1<0,sh*.9,sh);col=(m.C*sh*205)[:,None]*np.ones((1,3))
        for f in m.F:
            a,b,d=f;xs=sx[[a,b,d]];ys=sy[[a,b,d]];x0=int(max(0,np.floor(xs.min())));x1=int(min(W-1,np.ceil(xs.max())));y0=int(max(0,np.floor(ys.min())));y1=int(min(H-1,np.ceil(ys.max())))
            if x1<x0 or y1<y0:continue
            den=(ys[1]-ys[2])*(xs[0]-xs[2])+(xs[2]-xs[1])*(ys[0]-ys[2])
            if abs(den)<1e-9:continue
            gx,gy=np.meshgrid(np.arange(x0,x1+1)+.5,np.arange(y0,y1+1)+.5)
            l1=((ys[1]-ys[2])*(gx-xs[2])+(xs[2]-xs[1])*(gy-ys[2]))/den;l2=((ys[2]-ys[0])*(gx-xs[2])+(xs[0]-xs[2])*(gy-ys[2]))/den;l3=1-l1-l2
            msk=(l1>=-1e-6)&(l2>=-1e-6)&(l3>=-1e-6)
            if not msk.any():continue
            z=l1*Z[a]+l2*Z[b]+l3*Z[d];cl=l1[...,None]*col[a]+l2[...,None]*col[b]+l3[...,None]*col[d]
            sub=zb[y0:y1+1,x0:x1+1];up=msk&(z>sub);sub[up]=z[up];img[y0:y1+1,x0:x1+1][up]=cl[up].astype(np.uint8)
    return img
