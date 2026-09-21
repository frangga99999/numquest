# VPS dan Telegram

## VPS yang sudah aktif (diverifikasi 21 September 2026)

- SSH: `ubuntu@43.134.180.13`, port 22, menggunakan SSH key lokal.
- Aplikasi: `/home/ubuntu/mental-math`, layanan user `numquest.service`.
- Alamat: http://43.134.180.13:8790/ (HTTP 200 dari luar VPS).
- Bot: @VpsMangokubot; identitas telah diverifikasi dengan Telegram getMe.
- Bot menggunakan `hermes-gateway.service`, dengan allowlist pengguna terkonfigurasi.
- Panduan proyek bot: `/home/ubuntu/.hermes/skills/devops/numquest-vps/SKILL.md`.

Gunakan bot yang sudah berjalan ini, **jangan aktifkan numquest-telegram.service
dengan token bot yang sama**. Contoh pesan: “Cek status NumQuest di
/home/ubuntu/mental-math” atau “Perbaiki tampilan NumQuest, jalankan tes, lalu
tunjukkan perubahan sebelum deploy”. Respons percakapan end-to-end masih perlu
dicoba dari akun Telegram pemilik; verifikasi di atas memeriksa layanan dan identitas.

VPS memiliki perubahan lokal yang belum di-commit pada Foundation.jsx dan
engine.js, serta Calculator.jsx/CSS baru. Jangan pull atau menimpa perubahan ini
sebelum pengguna memilih versi keypad yang akan dipakai. Jangan hapus database
atau mengganti AUTH_SECRET. URL VPS belum HTTPS: jangan mengirim kata sandi/data
sensitif melalui URL tersebut; gunakan situs HTTPS Netlify sementara ini.

## Alternatif pemasangan baru (bukan bot aktif di atas)

Gunakan Linux dengan Node 24, Git, npm, systemd user, dan Codex CLI yang sudah login.
Frontend dist dan API dilayani oleh server/index.js pada proses yang sama.

## Pemasangan

1. Clone repository ke `$HOME/numquest` sebagai pengguna non-root. Buat checkout
   development terpisah dengan `git worktree add ../numquest-dev -b codex/telegram-dev`.
2. Di kedua checkout, jalankan `npm ci`. Di checkout produksi jalankan
   `VITE_API=/api npm run build`.
3. Buat direktori `$HOME/.config/numquest` dan `$HOME/.local/state/numquest`.
   Simpan konfigurasi aplikasi dalam app.env (chmod 600):

```dotenv
PORT=8790
AUTH_SECRET=ISI_RAHASIA_ACAK_YANG_PANJANG
DB_PATH=/home/USER/numquest-data.db
AI_KEY=ISI_DI_VPS
```

4. Simpan telegram.env (chmod 600) di direktori konfigurasi tersebut:

```dotenv
TELEGRAM_BOT_TOKEN=ISI_TOKEN_BOT_DI_VPS
TELEGRAM_OWNER_ID=ISI_ID_NUMERIK_AKUN_PRIBADI
NUMQUEST_REPO=/home/USER/numquest
NUMQUEST_DEV_REPO=/home/USER/numquest-dev
TELEGRAM_CURSOR_FILE=/home/USER/.local/state/numquest/telegram-offset
PATH=/usr/local/bin:/usr/bin:/bin:/home/USER/.npm-global/bin
```

5. Sesuaikan USER dan lokasi Node pada template ops/*.service. Salin ke
   `$HOME/.config/systemd/user/`, jalankan `systemctl --user daemon-reload`,
   lalu `systemctl --user enable --now numquest numquest-telegram`.
   Aktifkan linger untuk pengguna melalui administrator agar service tetap
   berjalan setelah SSH ditutup.
6. Pasang reverse proxy HTTPS ke 127.0.0.1:8790 menggunakan domain VPS. Batasi
   port aplikasi dari akses publik langsung jika memakai proxy. Verifikasi
   halaman utama, register/login, penyimpanan progres, serta restart service.

Bot menggunakan long polling Telegram, sehingga tidak membutuhkan port inbound
atau webhook. Jangan gunakan bot yang sama dengan polling/webhook lain.
Hanya pesan pribadi dari TELEGRAM_OWNER_ID yang dijalankan. Pesan lama saat
restart diabaikan; perintah berjalan satu per satu. Token tidak diwariskan ke
proses development. Jangan menyimpan .env/kredensial produksi di checkout dev.

## Perintah

- /status: status service dan commit produksi.
- /restart: mulai ulang aplikasi.
- /deploy: pull fast-forward dari branch terkonfigurasi, build, restart, health check.
- /develop <instruksi>: Codex mengedit checkout dev dengan sandbox workspace-write.
- /changes: daftar file development yang berubah.
- /check: jalankan test dan build checkout dev.

Review diff, commit, dan push di checkout development melalui SSH sebelum
menggabungkannya ke branch produksi dan menjalankan /deploy. Development dapat
menggunakan kuota akun Codex. Bot tidak melakukan deploy otomatis setelah edit.
Backup database SQLite sebelum operasi administrasi atau pembaruan schema.
Cursor disimpan sebelum menjalankan perintah untuk mencegah eksekusi ganda;
jika VPS mati di tengah perintah, cek status sebelum mengirim ulang.

Referensi: https://core.telegram.org/bots/api#getupdates
