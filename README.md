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
PNG transparan **3200×800 px** = 4 kotak persegi **800×800** berurutan kiri→kanan:
`DEPAN | KANAN | BELAKANG | KIRI`. Tanpa gantungan, tanpa background, barang di tengah, sisakan margin ≥20px; bagian atas barang di sekitar y=50 agar pas di gantungan.
Satu file per warna. Jenis: `kaos` (lengan pendek), `kaos-panjang`, `hoodie`, `aksesoris`. Mockup hitam/putih siap pakai ada di `mockups/` (nama `mockup-<jenis>-<hitam|putih>.png`). Pakai `templates/template-kaos|kaos-panjang|hoodie|aksesoris.png` sebagai panduan (sembunyikan layer panduan saat export).


## Tampilan
Awal: semua baju berjejer tampak samping di gantungan. Ketuk / geser dua jari / panah → baju terpilih berputar menghadap depan & membesar. Tombol Depan/Belakang & ↺↻ memutar halus (3D, ada ketebalan). Seret baju terpilih untuk memutar bebas. Ketuk area kosong / Esc → kembali berjejer.

## Format BARU: lembar pola (lebih gampang)
PNG transparan **1600×800 px** = 2 kotak 800×800: `DEPAN | BELAKANG`. Tidak perlu gambar samping — sisi & ketebalan dibuat otomatis oleh 3D, jadi putaran depan→samping→belakang halus.
Pakai `pola/template-pola-<jenis>.png` (biru, seperti template kit) sebagai panduan, hasilnya export tanpa layer panduan. Contoh siap pakai: `pola/pola-<jenis>-<hitam|putih>.png`.
Format lama 4 kotak (3200×800) tetap jalan; sistem otomatis mendeteksi dari rasio gambar.
