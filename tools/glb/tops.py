from glbkit import *
KIND={
 'kaos_lengan_pendek':dict(W=.27,L=False,hem=-.74,collar='crew',neck=.078,tmax=.034,cuff='stitch'),
 'kaos_lengan_panjang':dict(W=.27,L=True,hem=-.74,collar='crew',neck=.078,tmax=.034,cuff='rib',cw=.06),
 'jaket_pullover':dict(W=.3,L=True,hem=-.74,collar='hood',neck=.105,tmax=.038,hood=1,pocket='kanga',draw=1,cuff='rib',cw=.07,hemband=.075),
 'jaket_zip':dict(W=.3,L=True,hem=-.74,collar='hood',neck=.03,tmax=.038,hood=1,pocket='welt',zip=1,draw=1,cuff='rib',cw=.07,hemband=.075),
 'jaket_bomber':dict(W=.3,L=True,hem=-.62,collar='stand',neck=.02,tmax=.038,pocket='welt',zip=1,cuff='rib',cw=.07,hemband=.075,blouse=1),
 'jaket_windbreaker':dict(W=.3,L=True,hem=-.76,collar='hood',neck=.03,tmax=.036,hood=1,pocket='welt',zip=1,cuff='elastic',cw=.035,chevron=1,hemcord=1),
}
def unit(v): v=np.asarray(v,float); return v/np.linalg.norm(v)
def smoothc(P,k=3):
    o=np.zeros_like(P)
    for i in range(-k,k+1): o+=np.roll(P,i,0)
    return o/(2*k+1)
def make_top(name):
    K=KIND[name];W,L,hem,tmax,nk=K['W'],K['L'],K['hem'],K['tmax'],K['neck']
    so,si=((.62,-.64),(.55,-.71)) if L else ((.47,-.2),(.41,-.31))
    lower=[(.262,hem),(.262,hem+.075),(.292,-.5)] if K.get('blouse') else [(W,hem)]
    R=[*lower,(W,-.3),si,so,(W,-.05),(.09,0)];rR=[.02]*len(lower)+[.02,.012,.012,.035,.012]
    P=np.array(R+[(.045,.012),(0,.016),(-.045,.012)]+[(-x,y) for x,y in R[::-1]]);rad=rR+[.02,.03,.02]+rR[::-1]
    P,rad=ccw(P,rad);poly=round_poly(P,rad)
    def fold(ph):
        def f(x,y):
            a=.0035*np.sin(21*y+5*x+ph)+.0025*np.sin(37*x-11*y+2*ph)
            a=a+np.clip((np.abs(x)-W)/.08,0,1)*.004*np.sin(46*(.8*y-.6*np.abs(x))+ph)
            a=a+np.clip((-y-.5)/.2,0,1)*.003*np.sin(33*x+ph)+.004*np.exp(-((x/.2)**2+((y+.25)/.3)**2));return a
        return f
    def col(V,S,side):
        x,y=V[:,0],V[:,1];c=1-.18*(1-smooth(S/.045))
        for sx in (-1,1): c=c*(1-.32*np.exp(-(((x-sx*W)**2+(y+.3)**2)/.07**2)))
        c=np.where(side<0,c*(1-.5*smooth(1-np.hypot(x/.11,(y+.03)/.12))),c);return c*(.92+.08*np.clip((y+.75)/.75,0,1))
    ny=lambda x:-nk*np.clip(1-(x/.09)**2,0,1)**.8
    cut=lambda C:(np.abs(C[:,0])<.09)&(C[:,1]>ny(C[:,0]))
    body=pillow(poly,h=.015,tmax=tmax,e=.03,fold=(fold(0),fold(1.7)),cut=cut,col=col,tscale=lambda x,y:1+.12*smooth(-y/.74));M=[body]
    def ridge(pxy,rx=.002,rz=.0016,c=.85,front=True,off=.001):
        p=np.asarray(pxy,float);z=body.surf(p,front)+(off if front else -off)
        return tube(np.column_stack([p,z]),rx,rz,n=6,col=c,uvs=.03)
    def both(pxy,**k): return [ridge(pxy,front=True,**k),ridge(pxy,front=False,**k)]
    # --- kerah
    th=np.linspace(0,2*PI,72,endpoint=False);x=.09*np.cos(th);sn=np.sin(th);yf=ny(x);yb=.016*np.sqrt(np.clip(1-(x/.09)**2,0,1))
    zf=body.surf(np.column_stack([x,yf]),True);path=smoothc(np.column_stack([x,np.where(sn<0,yf,yb),np.where(sn<0,zf,-.012*sn)]))
    if K['collar']=='crew': M.append(tube(path,.014,.011,n=10,closed=True,mat=1,col=.92,uvs=.06))
    elif K['collar']=='hood': M.append(tube(path,.02,.015,n=10,closed=True,mat=1,col=.92,uvs=.06))
    else:
        ty=np.linspace(-.012,.05,9);ph=np.linspace(0,2*PI,56,endpoint=False);fl=.088+.008*np.linspace(0,1,9)
        Xc=np.outer(fl,np.sin(ph));Zc=np.outer(fl*.58,np.cos(ph))-.004;Yc=np.outer(ty,np.ones_like(ph))
        g=grid_surface(Xc,Yc,Zc,wrap=True,mat=1,uvs=.06);g.UV=np.stack([np.tile(ph/(2*PI)*12,9),np.repeat(ty,56)/.06],1);g.C=1-.18*np.clip(1-(g.V[:,1]+.012)/.03,0,1)*(g.V[:,2]<0.02)
        M.append(g);rp=np.column_stack([.096*np.sin(ph),np.full(56,.05),.056*np.cos(ph)-.004]);M.append(tube(rp,.006,.006,n=8,closed=True,mat=1,col=.95))
    # --- tudung
    if K.get('hood'):
        a=np.linspace(0,2*PI,64,endpoint=False);hp=np.column_stack([.125*np.cos(a),-.02+.125*np.sin(a)])
        hd=pillow(hp,h=.017,tmax=.04,e=.035,col=lambda V,S,sd:(.8+.14*smooth((V[:,1]+.1)/.2))*np.where(sd>0,.8,1.0))
        hd.V[:,2]+=-.04-.07*smooth((hd.V[:,1]+.02)/.125);M.append(hd)
    # --- rib pinggang
    hb=K.get('hemband',0);xw=.262 if K.get('blouse') else W
    if hb:
        bp=round_poly(ccw([(-xw,hem),(xw,hem),(xw,hem+hb),(-xw,hem+hb)]),.01)
        M.append(pillow(bp,h=.013,tmax=tmax*1.12+.012,e=.02,mat=1,uvs=.06,col=lambda V,S,sd:1-.12*(1-smooth(S/.03))))
    # --- manset / kelim lengan
    for sx in (1,-1):
        so_=np.array([sx*so[0],so[1]]);si_=np.array([sx*si[0],si[1]]);sh_=np.array([sx*W,-.05]);ar_=np.array([sx*W,-.3]);ut=unit(sh_-so_);ub=unit(ar_-si_)
        if K['cuff'] in('rib','elastic'):
            cw=K['cw'];q=round_poly(ccw([so_,si_,si_+ub*cw,so_+ut*cw]),.008);ax=unit((ut+ub)/2);pp=np.array([-ax[1],ax[0]])
            M.append(pillow(q,h=.011,tmax=tmax*1.12+.012,e=.018,mat=1,uvs=.06,uvrot=np.arctan2(pp[1],pp[0]),col=lambda V,S,sd:1-.12*(1-smooth(S/.025))))
        else: M+=both([so_+ut*.022,si_+ub*.022],c=.8)
        M+=both([sh_+np.array([-sx*.012,0]),sh_+np.array([-sx*.004,-.09]),sh_+np.array([-sx*.002,-.17]),ar_+np.array([-sx*.006,0])],c=.82)
    if not hb: M+=both([(-W+.02,hem+.028),(0,hem+.03),(W-.02,hem+.028)],rx=.0025,c=.85 if not K.get('hemcord') else .95)
    # --- resleting
    y0=-(nk if K['collar']=='crew' else .04);yz=hem+(hb if hb else .02)
    if K.get('zip'):
        ys=np.linspace(-.035,yz,40);zp=np.column_stack([np.zeros(40),ys]);z=body.surf(zp,True)+.002
        M.append(tube(np.column_stack([zp,z]),.0045,.0032,n=6,col=.5,uvs=.03))
        M.append(tube(np.array([[0,-.04,z[0]+.002],[0,-.078,z[0]+.002]]),.007,.005,n=6,col=.38));M.append(tube(np.array([[0,-.078,z[0]+.002],[0,-.115,z[0]+.002]]),.0035,.0022,n=6,col=.32))
    # --- tali tudung
    if K.get('draw'):
        for sx in (1,-1):
            t=np.linspace(0,1,12);pp=np.column_stack([sx*(.062+.008*t),-.1-.2*t]);z=body.surf(pp,True)+.004
            M.append(tube(np.column_stack([pp,z]),.0045,.004,n=7,col=1.0,uvs=.03));M.append(tube(np.array([[sx*.07,-.3,z[-1]],[sx*.071,-.325,z[-1]]]),.0036,.0034,n=7,col=.45))
    # --- saku
    if K.get('pocket')=='kanga':
        pk=round_poly(ccw([(-.2,-.46),(.2,-.46),(.255,-.665),(-.255,-.665)]),[.018,.018,.03,.03])
        M.append(pillow(pk,h=.013,tmax=.022,e=.02,zoff=.036,front_only=True,col=lambda V,S,sd:1-.14*(1-smooth(S/.02))))
        for sx in (1,-1): M.append(ridge([(sx*.2,-.465),(sx*.222,-.5),(sx*.238,-.56)],rx=.003,rz=.002,c=.5,off=.024))
    elif K.get('pocket')=='welt':
        y0_=-.34 if K.get('blouse') else -.44;y1_=hem+(hb if hb else .1)+.04
        for sx in (1,-1): M.append(ridge([(sx*.19,y0_),(sx*.205,(y0_+y1_)/2),(sx*.222,y1_)],rx=.0035,rz=.0022,c=.5))
    if K.get('chevron'):
        for dy in (0,-.028): M.append(ridge([(-.275,-.115+dy),(-.14,-.2+dy),(0,-.3+dy),(.14,-.2+dy),(.275,-.115+dy)],rx=.0025,rz=.002,c=.8))
    return M,dict(fit=True,zf=.049,kind=name)
