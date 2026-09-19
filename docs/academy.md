# Akademi berhitung

Dua jalur orisinal dengan dua belas modul per jalur, dari Dasar, Menengah,
Lanjut, hingga Mahir. Aritmatika menggunakan isian angka, operasi balik,
estimasi, persamaan, pangkat/akar, dan perubahan nilai. Psikotes menggunakan
pilihan ganda untuk deret, analogi, rasio, data, matriks, perbandingan
kuantitatif, dan kecepatan; ketelitian menggunakan isian digit. Timer 3 menit
bersifat opsional.

Bank berisi 1,2 juta entri parametrik (24 × 50.000), bukan soal tulisan manual
yang seluruhnya unik. Setiap parameter memiliki enam format terkontrol.
Parameter dipermutasi agar sesi tidak hanya mengganti satu angka berurutan.
Tiap entri mempunyai pembahasan deterministik.
Progres ketepatan terbaik dan posisi bank disimpan pada `g.academy`; latihan
baru tidak mengubah XP atau mastery jalur lama. Target 80% adalah anjuran,
bukan validasi psikometrik. Psikotes bukan asesmen klinis/rekrutmen resmi.

## AI

Endpoint POST `/api/academy/generate`, pada server Node dan Netlify.
Gunakan variabel server `AI_KEY`, opsional `AI_BASE` dan `AI_MODEL`.
Kunci tidak dikirim ke browser. AI merancang resep parameter dan campuran
format dari bank yang terkontrol, bukan membuat jawaban matematika bebas.
Resep divalidasi sebelum dipakai; delapan seed terbaru dikirim sebagai batas
agar sesi AI berikutnya tidak mengulangnya. Model timeout 10 detik; klien
timeout 14 detik, lalu memakai bank lokal dengan status yang terlihat.

## Sumber pedagogi

- Harvard Graduate School of Education: pertanyaan pengayaan dan pemikiran mendalam.
  https://www.gse.harvard.edu/ideas/usable-knowledge/26/04/helping-every-student-think-deeply-about-math
- Stanford / YouCubed: number sense dan fluency tanpa tekanan tes waktu.
  https://www.youcubed.org/resource/number-sense/
- Oxford Department of Education: intervensi terstruktur pemahaman angka dan aritmatika.
  https://www.education.ox.ac.uk/wp-content/uploads/2023/10/FINAL-Annual-Report-2022-23.pdf

Sumber memberi prinsip umum. Modul bukan kurikulum resmi atau produk berafiliasi
universitas; materi psikotes merupakan adaptasi NumQuest sendiri.

## Perbaikan alur lama

- Kolom tengah home tidak lagi disembunyikan pada tablet.
- Jarak kolom/kartu home ditambah 4px, lapisan glass, animasi masuk, reduced motion.
- Fokus dapat dimulai meski rencana harian belum selesai dimuat.
- Permintaan API dibatasi waktunya; produksi memakai `/api` secara default.
- Generator pilihan jawaban tidak lagi memakai loop acak tanpa batas.
- Sesi dengan bank kecil menggunakan pengulangan berjarak setelah bank unik habis,
  sehingga jumlah soal sesuai jumlah yang dijanjikan.

## Validasi

`npm test` mencakup 1,2 juta entri, identitas aritmatika, resep AI yang tidak valid,
AI gagal, tes fondasi, mesin lama, dan integrasi server. Server tests memerlukan
izin membuka port localhost. Build: `npm run build`.
