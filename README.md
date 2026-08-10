# NumQuest

Webapp mobile-first untuk orang dewasa (25–40) yang kesulitan berhitung. Tiga tingkat
(Dasar / Menengah / Mahir), target latihan mulai 5 menit sehari, pelacakan progres harian,
dan gamifikasi ala Duolingo + Clash of Clans.

```bash
npm install
npm run server   # API di http://localhost:8787
npm run dev      # aplikasi di http://localhost:5173
npm test         # mesin belajar + server
```

Aplikasi tetap berjalan penuh tanpa server: latihan, SRS, tugas harian, tantangan, dan
kerajaan semuanya lokal. Server dibutuhkan untuk akun, sinkronisasi antar-perangkat,
klan, liga, perang klan, dan pelatih AI.

## Peta berkas

| Bagian | Di mana |
|---|---|
| Generator soal, ragam bentuk, SRS, penguasaan, penyusun sesi, pasukan | `src/engine.js` |
| Tugas harian & tantangan bertema | `src/quests.js` |
| Pelatih cadangan + penempatan level dari diagnostik | `src/coach.js` |
| Progres, streak, nyawa, klaim tugas (localStorage) | `src/store.js` |
| Klien API + token | `src/api.js` |
| Ikon Feather | `src/Icon.jsx` |
| Sesi latihan (harian / tantangan / perang / pertahanan) | `src/Session.jsx` |
| Beranda, onboarding, akun, ringkasan, pengaturan | `src/App.jsx` |
| Progres harian & peta keterampilan | `src/Progress.jsx` |
| Kerajaan, lencana, toko | `src/Kingdom.jsx` |
| Klan, obrolan, perang klan | `src/Clan.jsx` |
| Liga, peta dunia, pertahanan kerajaan, pasukan | `src/Arena.jsx` |
| API: auth, sinkronisasi, klan, liga, perang | `server/index.js` |
| Skema database (node:sqlite) | `server/db.js` |
| Hash kata sandi + token (node:crypto) | `server/auth.js` |
| Panggilan model AI | `server/ai.js` |

Tidak ada framework backend dan tidak ada driver database — `node:http`, `node:sqlite`,
dan `node:crypto` semuanya bawaan Node 22+. Satu berkas `numquest.db`, tanpa infrastruktur.

## Soal

51 keterampilan di 10 domain, dibuat dari template berparameter (tak pernah habis), dan
tiap soal hitung bisa muncul dalam 4 bentuk:

| Bentuk | Contoh |
|---|---|
| Hitung langsung | `7 × 8 = ?` |
| Cari yang hilang | `7 × ? = 56` |
| Benar atau salah | `7 × 8 = 54` → benar atau salah? |
| Mana lebih besar | `7 × 8` atau `9 × 7`? |

Bentuk diturunkan dari teks soal lewat satu regex, jadi semua generator "A op B = ?"
langsung mendapat keempatnya tanpa kode tambahan. Bentuk baru dibuka bertahap: pemula
selalu dapat bentuk polos, ragam menyusul setelah pola dasarnya menempel.

Kunci kartu SRS menyimpan parameter dan bentuknya (`mul-tables:7,8:gap`), jadi
penjadwalan berjalan per-fakta — `7 × 8` dijadwalkan terpisah dari `6 × 9`.

## Peran AI

Mesin lokal yang memutuskan hal-hal terukur: apa yang muncul (SRS), kapan boleh naik
tingkat (ambang penguasaan), dan apakah sebuah tugas selesai. AI menambah tiga hal di
atasnya, sekali sehari:

1. **Pelatih harian** — memilih 3 skill fokus dan menulis pesan yang menyebut angka nyata.
2. **Tugas harian** — memilih 3 jenis tugas, takarannya, dan judulnya.
3. **Tantangan bertema** — memberi nama dan cerita untuk tantangan hari itu.

Semua keluaran model divalidasi ulang sebelum dipakai:

- Kenaikan tingkat selalu di-AND dengan `levelStatus()`. Model bahasa tidak boleh jadi
  wasit angka untuk orang yang sudah punya trauma matematika.
- Takaran tugas dijepit ke rentang yang bisa diselesaikan dalam `goalMin`–`goalMin × 3`.
- Skill fokus yang tidak ada di tingkat pengguna dibuang.
- Mekanik tantangan (wilayah + bentuk soal) tetap ditentukan lokal; AI hanya menamai.

Gagal, mati, atau tanpa kunci → generator lokal, dan aplikasi berjalan sama persis.

## Konfigurasi

`.env` (tidak masuk git):

```
AI_KEY=...                          # hanya dibaca server, tidak pernah sampai ke browser
AI_BASE=https://api.openai.com/v1   # ganti sesuai penyedia (kompatibel OpenAI)
AI_MODEL=gpt-4o-mini
AUTH_SECRET=...                     # WAJIB diganti sebelum dipakai orang lain
VITE_API=http://localhost:8787/api
```

## Ikon

Semua ikon dari [Feather](https://feathericons.com) lewat `react-feather`, diimpor
bernama di `src/Icon.jsx` supaya yang tidak dipakai tidak ikut ter-bundle. Tidak ada
emoji di seluruh antarmuka.

## Yang belum dibuat

- Langganan berbayar dan pembelian dalam aplikasi (toko sekarang memakai koin dari latihan).
- Peran Co-Leader dan Elder di klan — sekarang hanya Ketua dan Anggota.
- Moderasi otomatis untuk obrolan klan. Sekarang hanya ada batas panjang pesan dan
  tombol keluar klan. **Perlu ditambahkan sebelum dibuka ke publik.**
- Notifikasi push (butuh service worker + kunci VAPID).
- Mode offline penuh (service worker + cache soal).
