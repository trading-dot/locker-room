from glbkit import *
def outward(m,c):
    n=vnormals(m.V,m.F)
    if ((m.V-np.array(c))*n).sum(1).mean()<0: m.F=m.F[:,[0,2,1]]
    return m
def ridge_on(body,pxy,rx=.002,rz=.0016,c=.85,front=True,off=.001,mat=0):
    p=np.asarray(pxy,float);z=body.surf(p,front)+(off if front else -off)
    return tube(np.column_stack([p,z]),rx,rz,n=6,col=c,mat=mat,uvs=.03)
def band(y,y0,w): return smooth(1-np.abs(y-y0)/w)
def make_cap():
    cy=-.12;rx,rz,ry=.1,.105,.085;M=[];ph=np.linspace(0,2*PI,60,endpoint=False)
    rows=[(np.sin(t),cy+ry*np.cos(t)) for t in np.linspace(0,PI/2,22)]+[(1.0,cy-.012),(1.0,cy-.026),(.985,cy-.032)]
    X=np.array([rx*r*np.sin(ph) for r,_ in rows]);Z=np.array([rz*r*np.cos(ph) for r,_ in rows]);Y=np.array([np.full(60,y) for _,y in rows])
    crown=grid_surface(X,Y,Z,wrap=True,col=(1-.3*smooth((cy+.004-Y)/.036)).ravel(),uvs=.04);M.append(outward(crown,(0,cy,0)))
    d=np.vstack([[0,cy-.02,0],np.column_stack([rx*.98*np.sin(ph),np.full(60,cy-.02),rz*.98*np.cos(ph)])]);F=np.array([[0,1+i,1+(i+1)%60] for i in range(60)])
    dm=Mesh(d,d[:,[0,2]]/.05,np.full(len(d),.32),F);dn=vnormals(dm.V,dm.F)
    if dn[:,1].mean()>0: dm.F=dm.F[:,[0,2,1]]
    M.append(dm)
    for k in range(6):
        p=np.radians(30+60*k);t=np.linspace(0,PI/2,26);P=np.column_stack([rx*np.sin(t)*np.sin(p),cy+ry*np.cos(t),rz*np.sin(t)*np.cos(p)])
        n=np.column_stack([P[:,0]/rx**2,(P[:,1]-cy)/ry**2,P[:,2]/rz**2]);n/=np.linalg.norm(n,axis=1,keepdims=True)
        M.append(tube(P+n*.0012,.0016,.0013,n=6,ref=n,col=.8,uvs=.03))
    for yy in (cy-.013,cy-.026):
        r_=np.column_stack([rx*1.003*np.sin(ph),np.full(60,yy),rz*1.003*np.cos(ph)]);M.append(tube(r_,.0016,.0014,n=6,closed=True,ref=np.column_stack([np.sin(ph),np.zeros(60),np.cos(ph)]),col=.8))
    a_=np.linspace(0,2*PI,16,endpoint=False);th=np.linspace(0,PI,10)
    bt=grid_surface(np.outer(np.sin(th),.0085*np.sin(a_)),np.outer(np.cos(th),np.full(16,.0075))+cy+ry+.003,np.outer(np.sin(th),.0085*np.cos(a_)),wrap=True,col=.85);M.append(outward(bt,(0,cy+ry+.003,0)))
    a=np.radians(np.linspace(-80,80,27));Rr=np.column_stack([rx*.995*np.sin(a),rz*.995*np.cos(a)]);nn=np.column_stack([np.sin(a)/rx,np.cos(a)/rz]);nn/=np.linalg.norm(nn,axis=1,keepdims=True)
    Oo=np.column_stack([.113*np.sin(a),.19*np.cos(a)]);poly=np.vstack([Rr,Oo[::-1]]);R=np.full(len(poly),.004);R[[0,26,27,53]]=.02
    poly=round_poly(ccw(poly),R)
    bz=lambda zp:cy-.004-1.9*np.maximum(0,zp-.07)**2
    b=pillow(poly,h=.0075,tmax=.0045,e=.008,col=lambda V,S,sd:np.where(sd>0,1.0,.7)*(1-.1*(1-smooth(S/.012))),uvs=.04)
    V=b.V;b.V=np.column_stack([V[:,0],bz(V[:,1])+V[:,2],V[:,1]]);b.F=b.F[:,[0,2,1]];M.append(b)
    for dd in (.009,.017):
        P_=Oo-nn*dd;M.append(tube(np.column_stack([P_[:,0],bz(P_[:,1])+.0053,P_[:,1]]),.0014,.001,n=6,ref=(0,1,0),col=.8))
    return M,dict(fit=True,zf=.1,kind='aksesoris_topi')
def make_scarf():
    poly=round_poly(ccw([(-.08,0),(-.08,-.85),(.08,-.85),(.08,0)]),.008)
    fo=lambda ph:(lambda x,y:.005*np.sin(11*y+ph)+.003*np.sin(27*y+3*x+ph))
    col=lambda V,S,sd:(1-.14*(1-smooth(S/.025)))*(1-.22*(band(V[:,1],-.695,.007)+band(V[:,1],-.725,.007)))
    m=pillow(poly,h=.012,tmax=.017,e=.012,fold=(fo(0),fo(1.3)),mat=1,uvs=.05,col=col);M=[m];rg=np.random.default_rng(5)
    for i in range(18):
        x=-.07+.14*i/17;z=rg.uniform(-.006,.006);j=rg.uniform(-.004,.004);M.append(tube(np.array([[x,-.845,z],[x+j,-.88,z],[x+j*1.6,-.918,z]]),.002,.002,n=5,col=.9))
    return M,dict(fit=True,zf=.029,kind='aksesoris_syal')
def make_tote():
    poly=round_poly(ccw([(-.17,-.07),(-.17,-.45),(.17,-.45),(.17,-.07)]),[.012,.04,.04,.012])
    fo=lambda ph:(lambda x,y:.004*np.sin(17*y+9*x+ph)+.002*np.sin(29*x-13*y+ph))
    body=pillow(poly,h=.014,tmax=.058,e=.04,fold=(fo(0),fo(1.9)),col=lambda V,S,sd:(1-.16*(1-smooth(S/.05)))*(.9+.1*smooth((V[:,1]+.45)/.4)));M=[body]
    for sd in (True,False):
        for yy in (-.098,-.11): M.append(ridge_on(body,[(-.15,yy),(0,yy),(.15,yy)],rx=.0022,c=.85,front=sd))
    t_=np.linspace(0,PI,28)
    for sg in (1,-1):
        path=np.column_stack([-.088*np.cos(t_),-.098+.112*np.sin(t_),sg*(.05-.024*np.sin(t_))]);M.append(tube(path,.011,.0035,n=8,col=1.0,uvs=.03))
    pk=round_poly(ccw([(-.1,-.27),(-.1,-.39),(.1,-.39),(.1,-.27)]),.02)
    M.append(pillow(pk,h=.012,tmax=.02,e=.015,zoff=.056,front_only=True,col=lambda V,S,sd:1-.12*(1-smooth(S/.02))))
    return M,dict(fit=True,zf=.073,kind='aksesoris_tas')
def make_pouch():
    poly=round_poly(ccw([(-.15,-.04),(-.15,-.3),(.15,-.3),(.15,-.04)]),[.03,.035,.035,.03])
    fo=lambda ph:(lambda x,y:.003*np.sin(19*y+7*x+ph)+.002*np.sin(31*x-11*y+ph))
    body=pillow(poly,h=.012,tmax=.043,e=.032,fold=(fo(0),fo(2.1)),col=lambda V,S,sd:1-.15*(1-smooth(S/.04)));M=[body]
    for sd in (True,False):
        M.append(ridge_on(body,[(-.128,-.085),(0,-.085),(.128,-.085)],rx=.006,rz=.004,c=.45,front=sd,off=.001))
    z=body.surf(np.array([[.115,-.085]]),True)[0]
    M.append(tube(np.array([[.1,-.085,z+.003],[.128,-.085,z+.003]]),.009,.006,n=6,col=.35));M.append(tube(np.array([[.128,-.085,z+.003],[.142,-.125,z+.003]]),.003,.002,n=6,col=.3))
    P_=resample(poly,.01);T=np.roll(P_,-1,0)-np.roll(P_,1,0);T/=np.linalg.norm(T,axis=1,keepdims=True);Ni=P_+np.stack([-T[:,1],T[:,0]],1)*.014
    zz=body.surf(Ni,True)+.001;M.append(tube(np.column_stack([Ni,zz]),.0025,.0018,n=6,closed=True,col=.85))
    M.append(tube(np.array([[-.025,-.04,0],[-.027,-.0,0],[-.012,.022,0],[.012,.022,0],[.027,-.0,0],[.025,-.04,0]]),.006,.004,n=8,col=1.0))
    return M,dict(fit=True,zf=.049,kind='aksesoris_lainnya')
