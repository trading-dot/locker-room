# FVCKTHERULES — 3D Showroom
Situs ketiga (HTML/JS murni, tanpa build). Tidak punya katalog sendiri: produk, harga, stok, order memakai `https://fucktherules.my.id/firebase.js` (project `fvcktherules-store`). Data tambahan 3D ada di koleksi `produk3d` (ID dokumen = ID produk/aksesoris).

## Deploy (urutan penting)
1. Firebase Console → Firestore → Rules → tempel isi `firestore.rules` (rules lama + blok `produk3d`) → Publish.
2. GitHub → repo baru `fvcktherules-3d` (Public) → upload ISI folder ini ke `main`.
3. Settings → Pages → main / (root) → Custom domain `3d.fucktherules.my.id` → Enforce HTTPS.
4. DNS: CNAME host `3d` → `<username-github>.github.io`.
5. Firebase → Authentication → Settings → Authorized domains → tambah `3d.fucktherules.my.id`.
6. Google Cloud → Credentials → API key: jika ada referrer restriction, tambah `https://3d.fucktherules.my.id/*`.
7. Buka `/admin3d.html` → login admin → pilih produk → kategori → sub-tipe → upload desain → Simpan.

## Cara kerja
- Admin: pilih produk dari web utama, kategori (Jaket/Kaos/Aksesoris), sub-tipe (lengan pendek/panjang, hoodie, dst), upload banyak PNG sekaligus (nama file memuat depan/belakang/kiri/kanan), atur posisi dengan preview 3D, Simpan.
- Showroom: baca `produk` + `aksesoris` + `stok` + `produk3d` realtime. Ukuran dari field `stok`, SOLD OUT digelapkan. Checkout: bayar → upload bukti → `saveOrder` (status pending, sumber `3d-showroom`).
- Model: prosedural (kain di-extrude, bevel, tessellate, lipatan, bump anyaman). Taruh `.glb` di `assets/models/` untuk kualitas lebih tinggi (otomatis dipakai).

## Belum ada
Ongkir otomatis (Biteship), voucher, login pelanggan, fallback 2D jika WebGL gagal, atlas desain tunggal. Ongkir dikonfirmasi admin lewat WhatsApp.

## Update: showroom 360° (index.html baru)
- Ruangan putih ala video; kamera berputar 360° di tengah ruangan (geser untuk memutar, berputar otomatis di tab Store). Tab Hoodie / Kaos / Aksesoris memutar kamera ke dinding masing-masing; geser di zona untuk menyusuri rel.
- Baju digantung agak miring sehingga terlihat dari samping. Ketuk baju → kartu detail; geser untuk memutar atau pilih tampak Depan / Belakang / Kiri / Kanan.
- Terhubung ke web utama: `produk` + `aksesoris` (listenProduk/listenAksesoris), `stok` (ukuran + SOLD OUT), `produk3d` (diatur di `/admin3d.html`). Gambar desain tetap di Cloudinary lewat `FB.uploadGambar`; Firebase Storage tidak dipakai.
- Checkout: bukti bayar diunggah via `FB.uploadGambar(file,'bukti')`, lalu order `status: pending`, `sumber: 3d-showroom` lewat `FB.saveOrder` (jika ada) atau langsung ke koleksi `orders`. Cek `#sheet` handler di index.html jika format order web utama berbeda.
- Isi konstanta `PAY` di index.html untuk menampilkan info rekening.
- `core.js`, `ui.css`, dan file `rail*` tidak dipakai index.html baru (dibiarkan agar tidak merusak halaman lain).
