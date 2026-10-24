/* LOCKER 3D core (three r128). Atlas gambar: DEPAN | BELAKANG | KIRI | KANAN (2048x512) */
const LK={};
LK.COL={hitam:'#16161a',putih:'#f0f0ec',merah:'#c4161c',biru:'#2057b5',navy:'#15233f',hijau:'#2f6b3a',abu:'#80848a',cream:'#e6d9bb',coklat:'#6b4423',kuning:'#e2b72e',orange:'#e2641c',pink:'#e58aa5',ungu:'#5b3c8f',maroon:'#5a1620'};
LK.colors=s=>(s||'Hitam/Putih').split('/').map(x=>x.trim()).filter(Boolean).map(x=>{const[n,h]=x.split(':');return{n:n.trim(),h:(h||LK.COL[n.trim().toLowerCase().split(' ')[0]]||'#808080').trim()}});
// R = titik sisi kanan dari bawah ke leher (dicerminkan otomatis); f = area print depan/belakang; s = print sisi/lengan
LK.SH={
 kaos:{h:1.3,d:.14,dip:.2,R:[[.36,0],[.36,.84],[.68,.78],[.74,1],[.3,1.22],[.13,1.24]],f:[0,.6,.5,.5],s:[.71,.89,.15,.2,-.27]},
 hoodie:{h:1.34,d:.2,dip:.18,R:[[.4,0],[.42,.92],[.64,.14],[.8,.2],[.64,1.1],[.3,1.28],[.14,1.3]],f:[0,.82,.46,.42],s:[.725,.62,.15,.22,.18]},
 aksesoris:{h:.95,d:.12,dip:0,R:[[.4,0],[.4,.92]],f:[0,.46,.56,.56],s:[.4,.46,.1,.3,0]}
};
LK.shape=S=>{const s=new THREE.Shape(),R=S.R,n=R[R.length-1];s.moveTo(-R[0][0],R[0][1]);R.forEach(p=>s.lineTo(p[0],p[1]));s.quadraticCurveTo(0,n[1]-S.dip,-n[0],n[1]);R.slice(0,-1).reverse().forEach(p=>s.lineTo(-p[0],p[1]));return s};
LK.demo=()=>{const c=document.createElement('canvas');c.width=2048;c.height=512;const x=c.getContext('2d');x.fillStyle='#fff';x.textAlign='center';x.textBaseline='middle';[['FTR',160],['LOCKER ROOM',62],['F',200],['R',200]].forEach(([t,f],i)=>{x.font=`900 ${f}px Impact,Arial Black,sans-serif`;x.fillText(t,i*512+256,256)});return c};
LK.tint=(g,h)=>g.children[0].material.color.set(h);
LK.garment=(p,img)=>{
 const S=LK.SH[p.type]||LK.SH.kaos,g=new THREE.Group(),bt=.07,base=new THREE.MeshStandardMaterial({color:'#222',roughness:.95}),
 geo=new THREE.ExtrudeGeometry(LK.shape(S),{depth:S.d,bevelThickness:bt,bevelSize:.03,bevelSegments:6,curveSegments:14});
 geo.translate(0,-S.h/2,-S.d/2);
 const add=m=>{m.castShadow=true;g.add(m);return m};
 add(new THREE.Mesh(geo,base));
 if(p.type=='hoodie'){const h=add(new THREE.Mesh(new THREE.SphereGeometry(.21,24,16),base));h.scale.set(1.15,.9,.8);h.position.set(0,S.h/2-.04,-S.d/2-.06);
  const k=add(new THREE.Mesh(new THREE.BoxGeometry(.5,.2,.05),base));k.position.set(0,.2-S.h/2,S.d/2+bt+.01)}
 if(p.type=='aksesoris'){const t=add(new THREE.Mesh(new THREE.TorusGeometry(.2,.022,10,32,Math.PI),base));t.position.y=S.h/2-.02}
 if(img){
  const T=[0,1,2,3].map(i=>{const c=document.createElement('canvas'),sd=i>1,w=img.width/4,k=sd?.75:1;c.width=512*k;c.height=512;
   c.getContext('2d').drawImage(img,i*w+(sd?w*.125:0),0,w*k,img.height,0,0,c.width,512);
   const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;return t}),
  M=t=>new THREE.MeshStandardMaterial({map:t,transparent:true,roughness:.9,polygonOffset:true,polygonOffsetFactor:-4,depthWrite:false}),
  pl=(t,w,h,x,y,z,ry,rz=0)=>{const q=new THREE.Group(),m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),M(t));m.rotation.y=ry;q.add(m);q.position.set(x,y-S.h/2,z);q.rotation.z=rz;g.add(q)},
  z=S.d/2+bt+.004,[fx,fy,fw,fh]=S.f,[sx,sy,sw,sh,sr]=S.s;
  pl(T[0],fw,fh,fx,fy,z,0);pl(T[1],fw,fh,fx,fy,-z,Math.PI);
  pl(T[3],sw,sh,sx+.034,sy,0,Math.PI/2,sr);pl(T[2],sw,sh,-sx-.034,sy,0,-Math.PI/2,-sr)}
 g.userData.top=S.h/2;return g};
LK.hanger=()=>{const g=new THREE.Group(),m=new THREE.MeshStandardMaterial({color:'#b9bcc0',metalness:.8,roughness:.3}),a=new THREE.Mesh(new THREE.TorusGeometry(.04,.006,6,14,Math.PI*1.5),m),b=new THREE.Mesh(new THREE.BoxGeometry(.55,.012,.012),m);a.position.y=.1;b.position.y=.05;g.add(a,b);return g};
LK.room=sc=>{
 const M=(c,r=.7,m=0,e)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m,emissive:e||0,emissiveIntensity:e?1.5:0}),
 B=(w,h,d,x,y,z,mt)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mt);m.position.set(x,y,z);m.receiveShadow=true;sc.add(m);return m},
 wall=M('#2b3236',.95),teal=[M('#2f5d62',.45,.5),M('#3b4a56',.45,.5)],steel=M('#9aa3a8',.3,.9),
 c=document.createElement('canvas');c.width=128;c.height=512;const x=c.getContext('2d');
 x.fillStyle='#0b0d0e';for(let i=0;i<4;i++)x.fillRect(20,40+i*14,88,6);x.fillStyle='#c9d0d4';x.fillRect(100,230,10,90);x.font='700 18px Arial';x.fillText('0'+(1+Math.random()*8|0),50,460);
 const door=new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(c),transparent:true,roughness:.5}),
 bg=new THREE.BoxGeometry(.82,2.5,.5),dg=new THREE.PlaneGeometry(.8,2.46);
 B(15,.1,11,0,-.05,0,M('#4a4d4f',.85));B(15,.1,11,0,4.25,0,M('#1d2225',1));
 B(15,4.3,.1,0,2.1,-5.5,wall);B(15,4.3,.1,0,2.1,5.5,wall);B(.1,4.3,11,-7.5,2.1,0,wall);B(.1,4.3,11,7.5,2.1,0,wall);
 const row=(n,pitch,a,ry,fx)=>{for(let i=0;i<n;i++){const g=new THREE.Group(),b=new THREE.Mesh(bg,teal[i%2]),d=new THREE.Mesh(dg,door);
  b.position.y=1.25;d.position.set(0,1.25,.252);g.add(b,d);const o=(i-(n-1)/2)*pitch;g.position.set(fx?a:o,0,fx?o:a);g.rotation.y=ry;sc.add(g)}};
 row(16,.9,-5.2,0);row(16,.9,5.2,Math.PI);row(11,.9,-7.2,Math.PI/2,1);row(11,.9,7.2,-Math.PI/2,1);
 [-3.4,3.4].forEach(px=>{B(2.6,.08,.5,px,.5,-4.2,M('#8a6a45',.7));B(.08,.5,.4,px-1.2,.25,-4.2,steel);B(.08,.5,.4,px+1.2,.25,-4.2,steel)});
 [-3,3].forEach(px=>[-2,2].forEach(pz=>B(.25,.05,3,px,4.18,pz,M('#fff',.5,0,'#fffbe8'))));
 const ring=new THREE.Mesh(new THREE.RingGeometry(1,1.05,64),new THREE.MeshBasicMaterial({color:'#ff5a1f'}));ring.rotation.x=-Math.PI/2;ring.position.y=.01;sc.add(ring);
 [[-3,3.8,0],[3,3.8,0]].forEach(p=>{const l=new THREE.PointLight('#fff4dc',.5,12);l.position.set(...p);sc.add(l)});
 {const l=new THREE.PointLight('#fff4dc',.6,9);l.position.set(-4.5,2.6,0);sc.add(l)}
 sc.add(new THREE.DirectionalLight('#fff4e0',.8).translateX(2).translateY(5).translateZ(6))};
LK.zone=(sc,label,x,z,ry)=>{
 const g=new THREE.Group(),m=new THREE.MeshStandardMaterial({color:'#9aa3a8',metalness:.9,roughness:.3}),
 r=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,7.2,12),m);r.rotation.z=Math.PI/2;r.position.y=2.45;g.add(r);
 [-3.5,3.5].forEach(px=>{const c=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,1.75,8),m);c.position.set(px,3.32,0);g.add(c)});
 const c=document.createElement('canvas');c.width=1024;c.height=200;const q=c.getContext('2d');q.fillStyle='#0b0d0e';q.fillRect(0,0,1024,200);q.fillStyle='#ff5a1f';q.fillRect(0,0,1024,10);
 q.fillStyle='#f3efe6';q.font='800 120px Impact,Arial Black,sans-serif';q.textAlign='center';q.textBaseline='middle';q.fillText(label,512,110);
 const s=new THREE.Mesh(new THREE.PlaneGeometry(3.2,.62),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c)}));s.position.set(0,3.55,-.3);g.add(s);
 g.position.set(x,0,z);g.rotation.y=ry;sc.add(g);return g};

