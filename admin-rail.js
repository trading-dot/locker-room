import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js';
import {getAuth,signInWithEmailAndPassword,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js';
import {getFirestore,collection,getDocs,doc,setDoc,deleteDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';
const config={apiKey:"AIzaSyCVL_C4opQiKC6fNG_Rw4l-519rQZICH58",authDomain:"fvcktherules-store.firebaseapp.com",projectId:"fvcktherules-store",storageBucket:"fvcktherules-store.firebasestorage.app",messagingSenderId:"382347904485",appId:"1:382347904485:web:6715a7b395d44ad07a5b0c"};
const app=initializeApp(config),auth=getAuth(app),db=getFirestore(app);
// Reuse the same Cloudinary settings as the main website's payment-proof upload.
const CLOUDINARY_CLOUD='dfbxrouwf';
const CLOUDINARY_PRESET='underline-bukti';
async function uploadCloudinary(file,side,sourceId){
 if(!/^image\\/(png|jpeg|webp)$/.test(file.type))throw new Error('Gunakan gambar PNG, JPG, atau WebP.');
 if(file.size>8*1024*1024)throw new Error('Ukuran gambar maksimal 8 MB.');
 const form=new FormData();
 form.append('file',file);
 form.append('upload_preset',CLOUDINARY_PRESET);
 form.append('folder',`rail/${sourceId}`);
 form.append('public_id',`${side}-${Date.now()}`);
 const response=await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,{method:'POST',body:form});
 const result=await response.json();
 if(!response.ok)throw new Error(result.error?.message||'Upload Cloudinary gagal. Periksa preset upload bukti.');
 return result.secure_url;
}
const $=id=>document.getElementById(id);let sourceProducts=[],saved=[],editingId=null,files={};
$('loginBtn').onclick=async()=>{try{await signInWithEmailAndPassword(auth,$('email').value.trim(),$('password').value);$('loginMsg').textContent=''}catch(e){$('loginMsg').textContent='Login gagal. Periksa email/password dan akses admin.'}};
$('logoutBtn').onclick=()=>signOut(auth);
onAuthStateChanged(auth,async user=>{if(user){$('login').hidden=true;$('studio').hidden=false;$('authState').textContent=user.email||'SIGNED IN';await loadData()}else{$('login').hidden=false;$('studio').hidden=true;$('authState').textContent='NOT SIGNED IN'}});
async function loadData(){try{const [pSnap,rSnap]=await Promise.all([getDocs(collection(db,'produk')),getDocs(collection(db,'rail'))]);sourceProducts=pSnap.docs.map(d=>({id:d.id,...d.data()}));saved=rSnap.docs.map(d=>({id:d.id,...d.data()}));$('sourceProduct').innerHTML='<option value="">— Choose store product —</option>'+sourceProducts.map(p=>`<option value="${p.id}">${esc(p.nama||p.id)}</option>`).join('');renderSaved()}catch(e){$('sourceProduct').innerHTML='<option>Firestore access error</option>';$('saveMsg').textContent='Tidak bisa membaca data. Periksa Firestore Rules.'}}
$('sourceProduct').onchange=()=>{const p=sourceProducts.find(p=>p.id===$('sourceProduct').value);if(!p)return;$('displayName').value=p.nama||'';$('sourceMeta').textContent=`Product ID: ${p.id} · Harga: ${p.harga??'—'} · Warna: ${p.warna||'—'} · Thumbnail: ${p.thumbnail?'tersedia':'tidak ada'}`;};
$('atlasFile').onchange=e=>{const f=e.target.files[0];if(!f)return;files.atlas=f;const url=URL.createObjectURL(f);$('atlasPreview').innerHTML=`<img src="${url}" alt="Single atlas preview">`;};
$('saveBtn').onclick=async()=>{const sourceId=$('sourceProduct').value,name=$('displayName').value.trim();if(!sourceId){$('saveMsg').textContent='Pilih produk dari katalog website utama terlebih dahulu.';return}if(!name){$('saveMsg').textContent='Nama tampilan wajib diisi.';return}const p=sourceProducts.find(x=>x.id===sourceId);$('saveBtn').disabled=true;$('saveMsg').textContent='Saving…';try{const textures={...(saved.find(x=>x.id===editingId)?.textures||{})};if(files.atlas){textures.atlas=await uploadCloudinary(files.atlas,'atlas',sourceId)}const colors=[...document.querySelectorAll('#colorGrid input:checked')].map(x=>x.value);const id=sourceId;const data={sourceId,name,type:$('type').value,description:$('description').value.trim(),published:$('published').value==='true',colors,textures,sourceName:p?.nama||'',sourcePrice:p?.harga??null,sourceThumbnail:p?.thumbnail||'',updatedAt:serverTimestamp(),updatedBy:auth.currentUser?.uid||''};await setDoc(doc(db,'rail',id),data,{merge:true});saved=(await getDocs(collection(db,'rail'))).docs.map(d=>({id:d.id,...d.data()}));renderSaved();$('saveMsg').textContent='Saved successfully to Firestore /rail';editingId=id;files={};}catch(e){console.error(e);$('saveMsg').textContent='Gagal menyimpan: '+(e.code||e.message)}finally{$('saveBtn').disabled=false}};
function renderSaved(){$('savedList').innerHTML=saved.length?saved.map(p=>`<div class="saved-item"><div><b>${esc(p.name||p.id)}</b><small>${esc(p.type||'tee')} · ${p.published===false?'Draft':'Published'}</small></div><div><button data-edit="${p.id}">EDIT</button> <button data-del="${p.id}">DELETE</button></div></div>`).join(''):'<p class="hint">Belum ada piece. Pilih produk toko, atur tampilannya, lalu Save Piece.</p>';$('savedList').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>edit(saved.find(x=>x.id===b.dataset.edit)));$('savedList').querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(confirm('Hapus piece ini dari RAIL?')){await deleteDoc(doc(db,'rail',b.dataset.del));saved=saved.filter(x=>x.id!==b.dataset.del);renderSaved()}})}
function edit(p){editingId=p.id;$('sourceProduct').value=p.sourceId||p.id;$('sourceProduct').dispatchEvent(new Event('change'));$('displayName').value=p.name||'';$('type').value=p.type||'tee';$('description').value=p.description||'';$('published').value=String(p.published!==false);document.querySelectorAll('#colorGrid input').forEach(x=>x.checked=(p.colors||[]).includes(x.value));const u=p.textures?.atlas;$('atlasPreview').innerHTML=u?`<img src="${u}" alt="Single atlas preview">`:'＋ Upload single atlas';files={};$('saveMsg').textContent='Editing '+p.name};
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
