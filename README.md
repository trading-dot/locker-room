# Rail — rak baju 3D (GitHub Pages)

File: `index.html` (tampilan), `admin.html` (pengaturan), `rail-core.js`, `templates/*.png`, `CNAME`, `.nojekyll`.
Memakai `firebase.js` toko utama (produk, login admin, upload Cloudinary) — tidak ada katalog baru.

## WAJIB: tambah rules Firestore (di project fvcktherules-store)
Tempel di `firestore.rules` toko utama, di dalam `match /documents { ... }` dekat `match /produk`, lalu Publish:

    match /rail/{document=**} {
      allow read: if true;
      allow write: if isAdmin();
    }

## Format gambar (atlas)
PNG transparan **2400×800 px** = 4 kotak **600×800** berurutan kiri→kanan:
`DEPAN | KANAN | BELAKANG | KIRI`. Tanpa gantungan, tanpa background, barang di tengah, sisakan margin ≥20px.
Satu file per warna. Pakai `templates/template-kaos|hoodie|aksesoris.png` sebagai panduan (sembunyikan layer panduan saat export).
Kaos/hoodie: ujung atas kerah di sekitar y=60 agar pas di gantungan. Aksesoris: taruh di area tengah (±400×400).
