# Generator model GLB
Membuat 10 model di `assets/models/` yang otomatis dipakai `models.js` (nama file = `modelKey`):
`kaos_lengan_pendek`, `kaos_lengan_panjang`, `jaket_pullover`, `jaket_zip`, `jaket_bomber`, `jaket_windbreaker`,
`aksesoris_topi`, `aksesoris_syal`, `aksesoris_tas`, `aksesoris_lainnya`.

Jalankan ulang setelah mengubah bentuk: `python3 tools/glb/make_all.py --preview` lalu `python3 tools/glb/validate.py assets/models`.
- Bentuk atasan: `tops.py` (tabel `KIND` = lebar badan, panjang lengan, kerah, tudung, saku, resleting, rib).
- Aksesoris: `accs.py`. Pustaka mesh + penulis GLB: `glbkit.py`.
- Model memakai warna putih/abu + vertex color (bayangan lipatan); warna produk dari `warnaHex` mengalikan warna itu, jadi hasilnya tetap gelap-terang natural.
- Metadata GLB (`extras`): `fit:true` = ukuran sudah dalam meter & leher di y=0 (tanpa normalisasi), `zf` = jarak bidang desain depan/belakang.
- Model sendiri dari Blender/Meshy tetap bisa: taruh `.glb` dengan nama `modelKey` yang sama (tanpa `fit`, otomatis dinormalisasi tinggi 0,75 m).
