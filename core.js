/* LOCKER 3D core v2 (three r128). Atlas gambar: DEPAN | BELAKANG | KIRI | KANAN (2048x512) */
const LK={};
LK.COL={hitam:'#16161a',putih:'#f0f0ec',merah:'#c4161c',biru:'#2057b5',navy:'#15233f',hijau:'#2f6b3a',abu:'#80848a',cream:'#e6d9bb',coklat:'#6b4423',kuning:'#e2b72e',orange:'#e2641c',pink:'#e58aa5',ungu:'#5b3c8f',maroon:'#5a1620'};
LK.colors=s=>(s||'Hitam/Putih').split('/').map(x=>x.trim()).filter(Boolean).map(x=>{const[n,h]=x.split(':');return{n:n.trim(),h:(h||LK.COL[n.trim().toLowerCase().split(' ')[0]]||'#808080').trim()}});
LK.SH={
 kaos:{h:1.3,d:.12,dip:.2,R:[[.36,0],[.36,.84],[.68,.78],[.74,1],[.3,1.22],[.13,1.24]],f:[0,.6,.5,.5],s:[.71,.89,.12,.2,-.27]},
 hoodie:{h:1.34,d:.18,dip:.18,R:[[.4,0],[.42,.92],[.64,.14],[.8,.2],[.64,1.1],[.3,1.28],[.14,1.3]],f:[0,.82,.46,.42],s:[.725,.62,.15,.22,.18]},
 aksesoris:{h:.95,d:.1,dip:0,R:[[.4,0],[.4,.92]],f:[0,.46,.56,.56],s:[.4,.46,.1,.3,0]}};
LK.shape=S=>{const s=new THREE.Shape(),R=S.R,n=R[R.length-1];s.moveTo(-R[0][0],R[0][1]);R.forEach(p=>s.lineTo(p[0],p[1]));s.quadraticCurveTo(0,n[1]-S.dip,-n[0],n[1]);R.slice(0,-1).reverse().forEach(p=>s.lineTo(-p[0],p[1]));return s};
LK.tex=(w,h,fn,rx=1,ry=1)=>{const c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;return t};
LK.cloth=()=>LK._c||(LK._c=LK.tex(1024,1024,(x,w,h)=>{
 x.fillStyle='#808080';x.fillRect(0,0,w,h);
 for(let i=0;i<70;i++){x.save();x.translate(Math.random()*w,Math.random()*h);x.rotate((Math.random()-.5)*1.4+1.2);x.scale(1,.08+Math.random()*.1);
  const g=x.createRadialGradient(0,0,0,0,0,150+Math.random()*180),s=Math.random()>.5?'255,255,255':'0,0,0';g.addColorStop(0,`rgba(${s},.35)`);g.addColorStop(1,`rgba(${s},0)`);x.fillStyle=g;x.beginPath();x.arc(0,0,400,0,7);x.fill();x.restore()}
 x.globalAlpha=.1;for(let i=0;i<w;i+=3){x.fillStyle=i%6?'#000':'#fff';x.fillRect(i,0,1,h);x.fillStyle=i%6?'#fff':'#000';x.fillRect(0,i,w,1)}
 x.globalAlpha=.06;for(let i=0;i<30000;i++){x.fillStyle=Math.random()>.5?'#fff':'#000';x.fillRect(Math.random()*w,Math.random()*h,1,1)}},1.2,1.2));
LK.rib=r=>LK.tex(32,32,(x,w,h)=>{x.fillStyle='#808080';x.fillRect(0,0,w,h);for(let i=0;i<w;i+=8){x.fillStyle='#fff';x.fillRect(i,0,4,h);x.fillStyle='#000';x.fillRect(i+4,0,4,h)}},r,1);
LK.demo=()=>{const c=document.createElement('canvas');c.width=2048;c.height=512;const x=c.getContext('2d');x.textAlign='center';x.textBaseline='middle';x.fillStyle='#f4f1ea';
 const T=(t,f,px,y)=>{x.font=`900 ${f}px Impact,Arial Black,sans-serif`;x.fillText(t,px,y)};
 T('FTR',190,256,230);x.fillStyle='#ff5a1f';x.fillRect(96,330,320,8);x.fillStyle='#f4f1ea';T('FVCK THE RULES',34,256,380);
 T('LOCKER',130,768,190);T('ROOM',130,768,320);T('F',200,1280,256);T('R',200,1792,256);return c};
LK.tint=(g,h)=>g.userData.mats.forEach(m=>m.color.set(h));
LK.garment=(p,img)=>{
 const S=LK.SH[p.type]||LK.SH.kaos,g=new THREE.Group(),bt=.05,mats=[],
 M=(side,bm)=>{const m=new THREE.MeshStandardMaterial({color:'#222',roughness:.93,bumpMap:bm||LK.cloth(),bumpScale:bm?2:2.2,side:side||0});mats.push(m);return m},
 base=M(),geo=new THREE.ExtrudeGeometry(LK.shape(S),{depth:S.d,bevelThickness:bt,bevelSize:.025,bevelSegments:5,curveSegments:16}),
 add=(m,x=0,y=0,z=0,rz=0)=>{m.castShadow=true;m.position.set(x,y-S.h/2,z);m.rotation.z=rz;g.add(m);return m},zf=S.d/2+bt,
 rib=(w,h,x,y,rz,r)=>add(new THREE.Mesh(new THREE.BoxGeometry(w,h,S.d+bt*2+.02),M(0,LK.rib(r))),x,y,0,rz);
 geo.translate(0,-S.h/2,-S.d/2);const body=new THREE.Mesh(geo,base);body.castShadow=true;g.add(body);
 if(p.type=='hoodie'){
  const hd=add(new THREE.Mesh(new THREE.SphereGeometry(.23,32,20,0,Math.PI*2,0,Math.PI*.62),M(2)),0,S.h-.04,-S.d/2-.1);hd.rotation.x=-Math.PI/2;hd.scale.set(1.15,1,1.1);
  const ps=new THREE.Shape();ps.moveTo(-.24,0);ps.lineTo(.24,0);ps.lineTo(.2,.24);ps.lineTo(-.2,.24);
  add(new THREE.Mesh(new THREE.ExtrudeGeometry(ps,{depth:.012,bevelThickness:.012,bevelSize:.01,bevelSegments:2}),base),0,.1,zf-.005);
  rib(.82,.1,0,.05,0,26);rib(.17,.09,.72,.17,.36,6);rib(.17,.09,-.72,.17,-.36,6);
  const cm=new THREE.MeshStandardMaterial({color:'#e8e0cc',roughness:.8});[-.07,.07].forEach(px=>add(new THREE.Mesh(new THREE.CylinderGeometry(.007,.007,.3,8),cm),px,S.h-.2,zf+.01))}
 if(p.type=='kaos'){const c=add(new THREE.Mesh(new THREE.TorusGeometry(.125,.02,8,28,Math.PI),M(0,LK.rib(1))),0,1.24,zf-.012);c.rotation.z=Math.PI}
 if(p.type=='aksesoris')add(new THREE.Mesh(new THREE.TorusGeometry(.2,.025,8,32,Math.PI),base),0,S.h+.02-.02,0);
 if(img){
  const T=[0,1,2,3].map(i=>{const c=document.createElement('canvas'),sd=i>1,w=img.width/4,k=sd?.75:1;c.width=512*k;c.height=512;
   c.getContext('2d').drawImage(img,i*w+(sd?w*.125:0),0,w*k,img.height,0,0,c.width,512);
   const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;return t}),
  DM=t=>new THREE.MeshStandardMaterial({map:t,transparent:true,roughness:.88,bumpMap:LK.cloth(),bumpScale:1,polygonOffset:true,polygonOffsetFactor:-4,depthWrite:false}),
  pl=(t,w,h,x,y,z,ry,rz=0)=>{const q=new THREE.Group(),m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),DM(t));m.rotation.y=ry;q.add(m);q.position.set(x,y-S.h/2,z);q.rotation.z=rz;g.add(q)},
  z=zf+.004,[fx,fy,fw,fh]=S.f,[sx,sy,sw,sh,sr]=S.s;
  pl(T[0],fw,fh,fx,fy,z,0);pl(T[1],fw,fh,fx,fy,-z,Math.PI);
  pl(T[3],sw,sh,sx+.03,sy,0,Math.PI/2,sr);pl(T[2],sw,sh,-sx-.03,sy,0,-Math.PI/2,-sr)}
 g.userData={top:S.h/2,mats};return g};
LK.hanger=()=>{const g=new THREE.Group(),w=new THREE.MeshStandardMaterial({color:'#b88a56',roughness:.5}),mt=new THREE.MeshStandardMaterial({color:'#c9ccd0',metalness:.9,roughness:.25}),
 bx=(a,b,c,x,y,rz,m,geo)=>{const q=new THREE.Mesh(geo||new THREE.BoxGeometry(a,b,c),m);q.position.set(x,y,0);q.rotation.z=rz;q.castShadow=true;g.add(q);return q};
 bx(.32,.016,.022,-.145,.03,.2,w);bx(.32,.016,.022,.145,.03,-.2,w);bx(.58,.012,.014,0,-.002,0,w);
 bx(0,0,0,0,.115,0,mt,new THREE.CylinderGeometry(.006,.006,.11,8));
 const h=bx(0,0,0,0,.2,-Math.PI/2,mt,new THREE.TorusGeometry(.03,.006,8,16,5.3));return g};
LK.env=(R,sc)=>{const e=new THREE.Scene(),m=(c,i)=>new THREE.MeshBasicMaterial({color:new THREE.Color(c).multiplyScalar(i)});
 e.add(new THREE.Mesh(new THREE.BoxGeometry(20,10,20),new THREE.MeshBasicMaterial({color:'#1b2226',side:THREE.BackSide})));
 [[-4,4.6,-4],[4,4.6,-4],[-4,4.6,4],[4,4.6,4]].forEach(p=>{const l=new THREE.Mesh(new THREE.BoxGeometry(5,.2,1.2),m('#fff6e4',8));l.position.set(...p);e.add(l)});
 const p=new THREE.PMREMGenerator(R);sc.environment=p.fromScene(e,.04).texture;p.dispose()};
LK.room=sc=>{
 const T=LK.tex,M=o=>new THREE.MeshStandardMaterial(o),
 B=(w,h,d,x,y,z,mt)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mt);m.position.set(x,y,z);m.receiveShadow=true;sc.add(m);return m},
 noise=(x,w,h,n,a)=>{for(let i=0;i<n;i++){x.fillStyle=Math.random()>.5?`rgba(255,255,255,${a})`:`rgba(0,0,0,${a})`;x.fillRect(Math.random()*w,Math.random()*h,2,2)}},
 floor=T(512,512,(x,w,h)=>{x.fillStyle='#55595b';x.fillRect(0,0,w,h);noise(x,w,h,9000,.07);x.strokeStyle='#2a2d2f';x.lineWidth=4;x.strokeRect(0,0,w,h)},15,11),
 wood=T(256,256,(x,w,h)=>{x.fillStyle='#9a7048';x.fillRect(0,0,w,h);for(let i=0;i<60;i++){x.strokeStyle=`rgba(${Math.random()>.5?'60,35,15':'200,150,100'},.15)`;x.lineWidth=1+Math.random()*2;x.beginPath();const y=Math.random()*h;x.moveTo(0,y);x.bezierCurveTo(80,y+8,170,y-8,w,y+4);x.stroke()}}),
 door=T(256,788,(x,w,h)=>{x.fillStyle='#e9eaea';x.fillRect(0,0,w,h);const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(255,255,255,.25)');g.addColorStop(1,'rgba(0,0,0,.18)');x.fillStyle=g;x.fillRect(0,0,w,h);
  x.strokeStyle='#777';x.lineWidth=5;x.strokeRect(4,4,w-8,h-8);x.strokeStyle='rgba(255,255,255,.5)';x.lineWidth=2;x.strokeRect(10,10,w-20,h-20);
  [44,700].forEach(y0=>{for(let i=0;i<6;i++){const y=y0+i*16;x.fillStyle='#1a1c1d';x.fillRect(40,y,176,8);x.fillStyle='#fff';x.fillRect(40,y+8,176,2)}});
  x.fillStyle='#555';x.fillRect(218,360,14,100);x.fillStyle='#bbb';x.fillRect(220,362,3,96);x.fillStyle='#333';x.beginPath();x.arc(225,330,7,0,7);x.fill();noise(x,w,h,2500,.08)}),
 wall=M({color:'#323a3e',roughness:.92}),steel=M({color:'#aeb6bb',metalness:.9,roughness:.28}),
 cols=['#2f5d62','#3b4a56','#475a52','#3b4a56','#8a3b2a'].map(c=>({b:M({color:c,roughness:.45,metalness:.55}),d:M({color:c,map:door,bumpMap:door,bumpScale:2.5,roughness:.42,metalness:.5})})),
 bg=new THREE.BoxGeometry(.82,2.5,.5),dg=new THREE.PlaneGeometry(.8,2.46);
 B(15,.1,11,0,-.05,0,M({map:floor,roughness:.5,metalness:.1}));B(15,.1,11,0,4.25,0,M({color:'#1d2225',roughness:1}));
 B(15,4.3,.1,0,2.1,-5.5,wall);B(15,4.3,.1,0,2.1,5.5,wall);B(.1,4.3,11,-7.5,2.1,0,wall);B(.1,4.3,11,7.5,2.1,0,wall);
 const row=(n,pitch,a,ry,fx)=>{for(let i=0;i<n;i++){const g=new THREE.Group(),c=cols[i%5],b=new THREE.Mesh(bg,c.b),d=new THREE.Mesh(dg,c.d);
  b.position.y=1.25;d.position.set(0,1.25,.252);b.receiveShadow=d.receiveShadow=true;g.add(b,d);const o=(i-(n-1)/2)*pitch;g.position.set(fx?a:o,0,fx?o:a);g.rotation.y=ry;sc.add(g)}};
 row(16,.9,-5.2,0);row(16,.9,5.2,Math.PI);row(11,.9,-7.2,Math.PI/2,1);row(11,.9,7.2,-Math.PI/2,1);
 [-3.4,3.4].forEach(px=>{B(2.6,.06,.5,px,.5,-4.2,M({map:wood,roughness:.6})).castShadow=true;B(.08,.5,.4,px-1.2,.25,-4.2,steel);B(.08,.5,.4,px+1.2,.25,-4.2,steel)});
 [-3,3].forEach(px=>[-2,2].forEach(pz=>B(.25,.05,3,px,4.18,pz,M({color:'#fff',emissive:'#fffbe8',emissiveIntensity:1.5}))));
 [[3.9,-1.6],[3.9,1.6]].forEach(([y,z])=>{const q=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,15,16),steel);q.rotation.z=Math.PI/2;q.position.set(0,y,z);sc.add(q)});
 [[-3,3.8,0],[3,3.8,0],[-4.5,2.6,0]].forEach(p=>{const l=new THREE.PointLight('#fff4dc',.5,12);l.position.set(...p);sc.add(l)})};
LK.zone=(sc,label,x,z,ry)=>{
 const g=new THREE.Group(),m=new THREE.MeshStandardMaterial({color:'#b7bfc4',metalness:.95,roughness:.25}),
 r=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,7.2,16),m);r.rotation.z=Math.PI/2;r.position.y=2.45;r.castShadow=true;g.add(r);
 [-3.5,3.5].forEach(px=>{const c=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,1.75,8),m);c.position.set(px,3.32,0);g.add(c)});
 [-1.5,1.5].forEach(px=>{const c=new THREE.Mesh(new THREE.CylinderGeometry(.004,.004,.34,6),m);c.position.set(px,4.03,-.3);g.add(c)});
 const c=document.createElement('canvas');c.width=1024;c.height=200;const q=c.getContext('2d');q.fillStyle='#0b0d0e';q.fillRect(0,0,1024,200);q.fillStyle='#ff5a1f';q.fillRect(0,0,1024,10);
 q.fillStyle='#f3efe6';q.font='800 120px Impact,Arial Black,sans-serif';q.textAlign='center';q.textBaseline='middle';q.fillText(label,512,110);
 const s=new THREE.Mesh(new THREE.PlaneGeometry(3.2,.62),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c)}));s.position.set(0,3.55,-.3);g.add(s);
 const sp=new THREE.SpotLight('#fff1dc',1.7,14,.8,.9);sp.position.set(0,4,3);sp.target.position.set(0,1.6,-1);sp.castShadow=true;sp.shadow.mapSize.set(1024,1024);sp.shadow.radius=4;sp.shadow.bias=-.0005;g.add(sp,sp.target);
 g.position.set(x,0,z);g.rotation.y=ry;sc.add(g);return g};
