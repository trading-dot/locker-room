// Pembuat model 3D bersama (showroom + admin). Jika assets/models/<modelKey>.glb ada, GLB dipakai (otomatis);
// kalau tidak, dibuat prosedural: siluet kain di-extrude + bevel, di-tessellate, dilipat halus, bump anyaman.
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {TessellateModifier} from 'three/addons/modifiers/TessellateModifier.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
const gl=new GLTFLoader(),tl=new T.TextureLoader().setCrossOrigin('anonymous'),ok={},V=(x,y)=>new T.Vector2(x,y);
const weave=(()=>{const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d');x.fillStyle='#777';x.fillRect(0,0,32,32);x.fillStyle='#ccc';for(let i=0;i<32;i+=2){x.fillRect(i,0,1,32);x.fillRect(0,i,32,1)}const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(28,28);return t})();
const chaikin=(p,n)=>{while(n--){const q=[];p.forEach((a,i)=>{const b=p[(i+1)%p.length];q.push(V(.75*a.x+.25*b.x,.75*a.y+.25*b.y),V(.25*a.x+.75*b.x,.25*a.y+.75*b.y))});p=q}return p};
function soft(pts,d,b,n=3){let g=new T.ExtrudeGeometry(new T.Shape(chaikin(pts,n)),{depth:d,bevelThickness:b,bevelSize:b*.6,bevelSegments:5,curveSegments:1});g.translate(0,0,-d/2);g=new TessellateModifier(.028,8).modify(g);g.deleteAttribute('normal');g.deleteAttribute('uv');g=mergeVertices(g,1e-5);const p=g.attributes.position,u=new Float32Array(p.count*2);for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);p.setZ(i,z+Math.sign(z)*(Math.sin(x*38+y*7)*.004+Math.cos(y*24+x*6)*.004));u[2*i]=x;u[2*i+1]=y}g.setAttribute('uv',new T.BufferAttribute(u,2));g.computeVertexNormals();return g}
const rect=(w,h,y=0)=>[V(-w/2,y),V(w/2,y),V(w/2,y-h),V(-w/2,y-h)];
const LG=k=>/panjang|hoodie|bomber|windbreaker/.test(k||'');
export const MK=(kat,s)=>kat=='aksesoris'?'aksesoris_'+s:({'lengan-pendek':'kaos_lengan_pendek','lengan-panjang':'kaos_lengan_panjang','hoodie-zip':'jaket_zip','hoodie-pullover':'jaket_pullover',bomber:'jaket_bomber',windbreaker:'jaket_windbreaker'})[s];
// posisi baku desain (meter, x/y dari titik gantung, s = lebar, r = derajat)
export const dd=it=>{const L=LG(it.subtipe),a=it.kategori=='aksesoris',f={x:0,y:a?-.1:-.28,s:a?.14:.26,r:0};return{depan:f,belakang:{...f,y:a?-.1:-.26,s:a?.14:.3},lenganKiri:{x:L?.46:.37,y:L?-.3:-.2,s:.09,r:L?-70:-35},lenganKanan:{x:L?-.46:-.37,y:L?-.3:-.2,s:.09,r:L?70:35}}};

export async function build(it){
  const g=new T.Group(),body=new T.Group(),k=it.subtipe||'',col=it.warnaHex||'#8a8a8a',L=LG(k),acc=it.kategori=='aksesoris';
  const m=new T.MeshStandardMaterial({color:col,roughness:.92,bumpMap:weave,bumpScale:.6});
  const add=(geo,p,mt=m)=>{const o=new T.Mesh(geo,mt);if(p)o.position.set(...p);body.add(o);return o};
  let zf=.049;
  // hanger kayu + kait logam
  const wood=new T.MeshStandardMaterial({color:'#b98a5a',roughness:.45}),met=new T.MeshStandardMaterial({color:'#bbb',roughness:.3,metalness:1});
  [-1,1].forEach(s=>{const b=new T.Mesh(new T.CylinderGeometry(.007,.007,.23,8),wood);b.position.set(s*.11,.02,0);b.rotation.z=-s*1.35;g.add(b)});
  const hk=new T.Mesh(new T.TorusGeometry(.03,.004,8,24,4.7),met);hk.position.y=.085;g.add(hk);
  const st=new T.Mesh(new T.CylinderGeometry(.004,.004,.04,8),met);st.position.y=.05;g.add(st);
  const key=it.modelKey;
  if(key)ok[key]??=fetch(`assets/models/${key}.glb`,{method:'HEAD'}).then(r=>r.ok).catch(()=>false);
  if(key&&await ok[key]){
    const o=(await gl.loadAsync(`assets/models/${key}.glb`)).scene;
    o.traverse(c=>{if(c.isMesh){c.material=c.material.clone();c.material.color.set(col)}});
    const b=new T.Box3().setFromObject(o);o.scale.setScalar(.75/(b.max.y-b.min.y));o.position.y-=new T.Box3().setFromObject(o).max.y;body.add(o);
  }else if(acc){
    m.side=T.DoubleSide;
    if(k=='topi'){const d=add(new T.SphereGeometry(.1,40,20,0,6.2832,0,1.5708),[0,-.12,0]);d.scale.y=.85;const br=add(new T.CircleGeometry(.11,32,0,Math.PI),[0,-.12,0]);br.rotation.x=Math.PI/2;zf=.1}
    else if(k=='syal'){add(soft(rect(.16,.85),.02,.015,2));zf=.029}
    else if(k=='tas'){add(soft(rect(.34,.38,-.14),.08,.03,2));add(new T.TorusGeometry(.09,.007,8,24,Math.PI),[0,-.14,0]);zf=.073}
    else add(soft(rect(.3,.3),.04,.025,2));
  }else{
    const W=/hoodie|bomber|windbreaker/.test(k)?.3:.27,so=L?[.62,-.64]:[.47,-.2],si=L?[.55,-.71]:[.41,-.31];
    const R=[[W,-.05],so,si,[W,-.3],[W,-.74]],Lf=[[-W,-.74],[-W,-.3],[-si[0],si[1]],[-so[0],so[1]],[-W,-.05]];
    add(soft([[-.09,0],[-.05,-.06],[0,-.08],[.05,-.06],[.09,0],...R,...Lf].map(a=>V(...a)),.04,.025,3));
    if(/hoodie/.test(k)){const h=[];for(let i=0;i<24;i++){const a=i/24*6.2832;h.push(V(Math.cos(a)*.13,Math.sin(a)*.17))}add(soft(h,.07,.03,2),[0,.03,-.07])}
    if(/zip|bomber|windbreaker/.test(k))add(new T.BoxGeometry(.012,.66,.012),[0,-.42,.052],new T.MeshStandardMaterial({color:'#222',roughness:.3,metalness:.8}));
  }
  // desain (PNG transparan) sebagai decal depan/belakang/lengan
  const D=dd(it);
  for(const n in D){const u=it.tex?.[n];if(!u)continue;const d={...D[n],...(it.decal?.[n]||{})};
    tl.load(u,t=>{t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;const w=d.s,bk=n=='belakang',
      pl=new T.Mesh(new T.PlaneGeometry(w,w*t.image.height/t.image.width),new T.MeshStandardMaterial({map:t,transparent:true,roughness:.85,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));
      pl.position.set(d.x,d.y,bk?-zf:zf);if(bk)pl.rotation.y=Math.PI;pl.rotation.z=d.r*Math.PI/180*(bk?-1:1);body.add(pl)})}
  body.position.y=-.03;body.traverse(o=>{if(o.isMesh)o.castShadow=true});g.add(body);
  return g;
}
